const searchInput = document.querySelector('.search-input');
const cards = document.querySelectorAll('.tab-card');
const menu = document.querySelector('.mainmenu');
const toggleMenu = document.querySelector('.dropmenu');
const openAllButton = document.querySelector('.opentabs');
const refreshButton = document.querySelector('.refresh-page');
const extensionBadge = document.querySelector('.extension-badge');

const showToast = (message, x, y) => {
  const toast = document.createElement('div');
  toast.className = 'popup';
  toast.textContent = message;
  toast.style.left = `${x}px`;
  toast.style.top = `${y}px`;
  document.body.appendChild(toast);

  window.setTimeout(() => {
    toast.remove();
  }, 850);
};

if (openAllButton) {
  const urls = [...document.querySelectorAll('.tab-open-link')].map((link) => link.href);
  openAllButton.addEventListener('click', () => {
    urls.forEach((url, index) => {
      const targetWindow = window.open(url, '_blank');
      if (!targetWindow) return;
      if (index > 0) {
        window.setTimeout(() => targetWindow.location.href = url, 250 * index);
      }
    });
  });
}

if (refreshButton) {
  refreshButton.addEventListener('click', () => {
    window.location.reload();
  });
}

const handleSearch = (event) => {
  const value = event.target.value.trim().toLowerCase().replace(/\s+/g, '');

  cards.forEach((card) => {
    if (!card.classList.contains('tab-card')) {
      return;
    }

    const title = card.querySelector('.tab-title')?.textContent.toLowerCase() || '';
    const url = card.querySelector('.tab-url')?.textContent.toLowerCase() || '';
    const matches = !value || title.includes(value) || url.includes(value);
    card.style.display = matches ? 'grid' : 'none';
  });
};

if (searchInput) {
  searchInput.addEventListener('input', handleSearch);
}

if (toggleMenu && menu) {
  toggleMenu.addEventListener('click', () => {
    menu.classList.toggle('hide');
  });
}

document.querySelectorAll('.tab-url').forEach((element) => {
  element.addEventListener('click', async (event) => {
    event.preventDefault();
    const text = element.textContent.trim();

    try {
      await navigator.clipboard.writeText(text);
      showToast('Copied!', event.clientX, event.clientY);
    } catch (error) {
      const tempInput = document.createElement('input');
      tempInput.value = text;
      document.body.appendChild(tempInput);
      tempInput.select();
      document.execCommand('copy');
      tempInput.remove();
      showToast('Copied!', event.clientX, event.clientY);
    }
  });
});

if (extensionBadge) {
  extensionBadge.addEventListener('click', () => {
    window.open('/getextension', '_blank');
  });
}

const supportHover = () => {
  const isDesktop = window.matchMedia('(min-width: 768px)').matches;
  if (!isDesktop || !extensionBadge) return;

  const badgeSvg = extensionBadge.querySelector('svg');
  if (!badgeSvg) return;

  extensionBadge.addEventListener('mouseover', () => {
    badgeSvg.style.transform = 'scale(1.08)';
  });

  extensionBadge.addEventListener('mouseout', () => {
    badgeSvg.style.transform = 'scale(1)';
  });
};

supportHover();