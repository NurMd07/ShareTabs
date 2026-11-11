const button = document.querySelector('.send-button');
const logoutButton = document.querySelector('.logout-button');
const checkbox = document.querySelector('#current-tab-only');
const domainInput = document.querySelector('#domain');
const usernameInput = document.querySelector('#username');
const passwordInput = document.querySelector('#password');
const credentialsForm = document.querySelector('.credentials');
const signedInMessage = document.querySelector('.signed-in');
const statusMessage = document.querySelector('.status');

let savedSettings = null;

const setStatus = (message, isError = false) => {
  statusMessage.textContent = message;
  statusMessage.classList.toggle('text-danger', isError);
  statusMessage.classList.toggle('text-success', !isError && Boolean(message));
};

const getSettings = () => new Promise((resolve, reject) => {
  chrome.storage.local.get(['extensionSettings'], (result) => {
    if (chrome.runtime.lastError) {
      reject(new Error(chrome.runtime.lastError.message));
      return;
    }

    resolve(result.extensionSettings || null);
  });
});

const saveSettings = (settings) => new Promise((resolve, reject) => {
  chrome.storage.local.set({ extensionSettings: settings }, () => {
    if (chrome.runtime.lastError) {
      reject(new Error(chrome.runtime.lastError.message));
      return;
    }

    resolve();
  });
});

const clearSettings = () => new Promise((resolve, reject) => {
  chrome.storage.local.remove('extensionSettings', () => {
    if (chrome.runtime.lastError) {
      reject(new Error(chrome.runtime.lastError.message));
      return;
    }

    resolve();
  });
});

const requestHostPermission = (origin) => new Promise((resolve, reject) => {
  chrome.permissions.request({ origins: [`${origin}/*`] }, (granted) => {
    if (chrome.runtime.lastError) {
      reject(new Error(chrome.runtime.lastError.message));
      return;
    }

    resolve(granted);
  });
});

const sendRuntimeMessage = (action) => new Promise((resolve, reject) => {
  chrome.runtime.sendMessage({ action }, (response) => {
    if (chrome.runtime.lastError) {
      reject(new Error(chrome.runtime.lastError.message));
      return;
    }

    resolve(response);
  });
});

const getStoredUrls = () => new Promise((resolve, reject) => {
  chrome.storage.local.get(['urls'], (result) => {
    if (chrome.runtime.lastError) {
      reject(new Error(chrome.runtime.lastError.message));
      return;
    }

    resolve(result.urls);
  });
});

const refreshDashboardTabs = (domain) => new Promise((resolve, reject) => {
  chrome.tabs.query({ url: `${domain}/*` }, (tabs) => {
    if (chrome.runtime.lastError) {
      reject(new Error(chrome.runtime.lastError.message));
      return;
    }

    const tabIds = tabs.map((tab) => tab.id).filter(Number.isInteger);
    if (!tabIds.length) {
      resolve(false);
      return;
    }

    Promise.all(tabIds.map((tabId) => new Promise((resolveReload, rejectReload) => {
      chrome.tabs.reload(tabId, () => {
        if (chrome.runtime.lastError) {
          rejectReload(new Error(chrome.runtime.lastError.message));
          return;
        }

        resolveReload();
      });
    }))).then(() => resolve(true), reject);
  });
});

const encodeBasicCredentials = (username, password) => {
  const bytes = new TextEncoder().encode(`${username}:${password}`);
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');

  return `Basic ${btoa(binary)}`;
};

const normalizeDomain = (value) => {
  const input = value.trim();
  if (!input) {
    throw new Error('Enter your dashboard domain.');
  }

  let url;
  try {
    url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
  } catch (error) {
    throw new Error('Enter a valid dashboard domain, such as example.com.');
  }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname ||
      url.username || url.password || (url.pathname !== '/' && url.pathname !== '') ||
      url.search || url.hash) {
    throw new Error('Enter a domain only, such as example.com.');
  }

  return url.origin;
};

const setSignedIn = (settings) => {
  savedSettings = settings;
  credentialsForm.hidden = Boolean(settings);
  signedInMessage.hidden = !settings;
  logoutButton.hidden = !settings;
  signedInMessage.textContent = settings ? `Signed in to ${settings.domain}` : '';
  if (settings) {
    domainInput.value = settings.domain;
    usernameInput.value = settings.username;
    passwordInput.value = settings.password;
  }
};

const getUrls = async (currentTabOnly, domain) => {
  await sendRuntimeMessage(currentTabOnly ? 'currentTab' : 'buttonClicked');
  const storedUrls = await getStoredUrls();
  const destinationHostname = new URL(domain).hostname.toLowerCase();
  const urls = (Array.isArray(storedUrls) ? storedUrls : [storedUrls])
    .filter((url) => typeof url === 'string')
    .map((url) => url.trim())
    .filter((url) => {
      if (!/^https?:\/\//i.test(url)) {
        return false;
      }

      try {
        return new URL(url).hostname.toLowerCase() !== destinationHostname;
      } catch (error) {
        return false;
      }
    });

  return { urls };
};

const sendTabs = async () => {
  const username = savedSettings ? savedSettings.username : usernameInput.value.trim();
  const password = savedSettings ? savedSettings.password : passwordInput.value;
  let domain;

  try {
    domain = normalizeDomain(savedSettings ? savedSettings.domain : domainInput.value);
    if (!username || !password) {
      throw new Error('Enter your username and password.');
    }
  } catch (error) {
    setStatus(error.message, true);
    return;
  }

  button.disabled = true;
  button.textContent = 'Sending...';
  setStatus('');

  try {
    const granted = await requestHostPermission(domain);
    if (!granted) {
      throw new Error('Permission to connect to this domain was not granted.');
    }

    const tabData = await getUrls(checkbox.checked, domain);
    if (!tabData.urls.length) {
      throw new Error('No eligible tabs to send.');
    }

    let response;
    try {
      response = await fetch(`${domain}/urls`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: encodeBasicCredentials(username, password)
        },
        body: JSON.stringify({ urls: tabData.urls })
      });
    } catch (error) {
      throw new Error(`Could not connect to ${domain}: ${error.message}`);
    }

    const result = await response.json().catch(() => null);
    if (response.status === 401) {
      throw new Error('Username or password is incorrect.');
    }
    if (response.status === 503) {
      throw new Error('Extension sign-in is unavailable. Contact the site administrator.');
    }
    if (!response.ok || !(result === 'success' || result?.success === true)) {
      throw new Error(result?.message || 'Could not send tabs. Please try again.');
    }

    const settings = { domain, username, password };
    let successMessage = `${result.saved ?? tabData.urls.length} tab(s) sent.`;
    let hasWarning = false;
    try {
      await saveSettings(settings);
      setSignedIn(settings);
      successMessage += ' Details saved.';
    } catch (error) {
      successMessage += ` Details could not be saved: ${error.message}`;
      hasWarning = true;
    }

    button.textContent = 'Sent';
    try {
      if (await refreshDashboardTabs(domain)) {
        successMessage += ' Dashboard tab refreshed.';
      }
    } catch (error) {
      successMessage += ` Could not refresh dashboard: ${error.message}`;
      hasWarning = true;
    }
    setStatus(successMessage, hasWarning);
  } catch (error) {
    button.textContent = checkbox.checked ? 'Send Current Tab' : 'Send All Tabs';
    setStatus(error.message || 'Could not send tabs. Please try again.', true);
  } finally {
    button.disabled = false;
  }
};

const logout = async () => {
  logoutButton.disabled = true;
  try {
    await clearSettings();
    setSignedIn(null);
    domainInput.value = '';
    usernameInput.value = '';
    passwordInput.value = '';
    setStatus('Saved details cleared.');
  } catch (error) {
    setStatus(`Could not clear saved details: ${error.message}`, true);
  } finally {
    logoutButton.disabled = false;
  }
};

const initialize = async () => {
  try {
    setSignedIn(await getSettings());
  } catch (error) {
    setStatus(`Could not load saved details: ${error.message}`, true);
  }
};

checkbox.addEventListener('change', () => {
  button.textContent = checkbox.checked ? 'Send Current Tab' : 'Send All Tabs';
});

button.addEventListener('click', sendTabs);
logoutButton.addEventListener('click', logout);
initialize();
