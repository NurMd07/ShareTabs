const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const cheerio = require('cheerio');
require('dotenv').config();

const Tab = require('./models/tabs');
const validateExtensionAuthorization = require('./utils/extension-auth');

const app = express();
const env = process.env.ENV || 'development';
const PORT = Number(process.env.PORT) || (env === 'development' ? 8000 : 9004);

app.disable('x-powered-by');

mongoose.set('strictQuery', false);

const normalizeUrl = (value) => {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const hasProtocol = /^https?:\/\//i.test(trimmed);
  const normalized = hasProtocol ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(normalized);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return parsed.toString().replace(/\/$/, '');
  } catch (error) {
    return null;
  }
};

const resolveFaviconUrl = (baseUrl, faviconPath) => {
  if (!faviconPath) return '/no-favicon.png';

  if (/^https?:\/\//i.test(faviconPath)) {
    return faviconPath;
  }

  if (faviconPath.startsWith('//')) {
    return `https:${faviconPath}`;
  }

  if (faviconPath.startsWith('/')) {
    return new URL(faviconPath, baseUrl).toString();
  }

  return new URL(faviconPath, baseUrl).toString();
};

const extractMetadata = async (inputUrl) => {
  const url = normalizeUrl(inputUrl);
  if (!url) return null;

  const html = await fetch(url, {
    headers: { 'User-Agent': 'ShareTabs/1.1 (+https://github.com/NurMd07/shareTabs)' },
    signal: AbortSignal.timeout(10000)
  }).then((response) => response.text()).catch(() => '');

  if (!html) {
    return {
      title: new URL(url).hostname,
      url,
      icon: '/no-favicon.png'
    };
  }

  const $ = cheerio.load(html);
  const description =
    $('meta[name="description"]').attr('content') ||
    $('meta[property="og:description"]').attr('content') ||
    $('meta[name="twitter:description"]').attr('content') ||
    '';

  const title =
    $('meta[property="og:title"]').attr('content') ||
    $('meta[name="title"]').attr('content') ||
    $('title').first().text() ||
    new URL(url).hostname;

  let icon =
    $('link[rel="icon"]').attr('href') ||
    $('link[rel="shortcut icon"]').attr('href') ||
    $('link[rel="apple-touch-icon"]').attr('href');

  if (!icon) {
    try {
      const faviconResponse = await fetch(new URL('/favicon.ico', url).toString(), {
        headers: { 'User-Agent': 'ShareTabs/1.1 (+https://github.com/NurMd07/shareTabs)' },
        signal: AbortSignal.timeout(7000)
      });
      icon = faviconResponse.ok ? new URL('/favicon.ico', url).toString() : null;
    } catch (error) {
      icon = null;
    }
  }

  const cleanTitle = title.trim();
  const finalTitle = cleanTitle || description || new URL(url).hostname;

  return {
    title: finalTitle,
    url,
    icon: icon ? resolveFaviconUrl(url, icon) : '/no-favicon.png'
  };
};

const formatDate = (dateValue) => {
  const options = {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: 'numeric',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  };

  const date = new Date(dateValue).toLocaleString('en-US', options);
  const [datePart, timePart] = date.split(', ');
  const [month, day] = datePart.split(' ');

  return `${day} ${month} ${timePart}`;
};

const parseIncomingUrls = (payload) => {
  if (!payload || Object.keys(payload).length === 0) return { urls: [], fromMainPage: false };

  if (Array.isArray(payload.urls)) {
    return {
      urls: payload.urls.filter((entry) => typeof entry === 'string').map((entry) => entry.trim()).filter(Boolean),
      fromMainPage: false
    };
  }

  if (typeof payload.urls === 'string') {
    return {
      urls: payload.urls.split(/[\s,]+/).map((item) => item.trim()).filter(Boolean),
      fromMainPage: true
    };
  }

  return { urls: [], fromMainPage: true };
};

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/tabs', { dbName: 'tabs' })
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Environment: ${env}`);
      console.log(`Port: ${PORT}`);
      console.log('Connected to MongoDB');
      console.log('Server started');
    });
  })
  .catch((error) => {
    console.error('Error connecting to MongoDB:', error.message);
    process.exit(1);
  });

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');

app.get('/', async (req, res) => {
  try {
    const allTabs = await Tab.find({}).sort({ pin: -1, createdAt: -1 });
    const tabs = allTabs.map((tab) => ({
      title: tab.title,
      url: tab.url,
      icon: tab.icon || '/no-favicon.png',
      createdAt: formatDate(tab.createdAt),
      id: tab._id,
      pin: Boolean(tab.pin)
    }));

    res.render('home', { tabs });
  } catch (error) {
    console.error('Failed to load tabs:', error);
    res.status(500).render('home', { tabs: [] });
  }
});

app.post('/urls', async (req, res) => {
  if (req.body && Array.isArray(req.body.urls)) {
    const authResult = validateExtensionAuthorization(
      req.get('authorization'),
      process.env.USERNAME,
      process.env.PASSWORD
    );

    if (authResult === 'unavailable') {
      return res.status(503).json({ message: 'Extension authentication is not configured' });
    }

    if (authResult === 'unauthorized') {
      return res.status(401).json({ message: 'Invalid extension credentials' });
    }
  }

  const { urls, fromMainPage } = parseIncomingUrls(req.body);

  if (!urls.length) {
    if (fromMainPage) {
      return res.redirect('/');
    }

    return res.status(400).json({ message: 'No URL provided' });
  }

  const savedUrls = [];
  const errors = [];

  for (const entry of urls) {
    const url = normalizeUrl(entry);
    if (!url) {
      errors.push(entry);
      continue;
    }

    try {
      const existingTab = await Tab.findOne({ url });
      if (existingTab) {
        savedUrls.push(existingTab._id);
        continue;
      }

      const metadata = await extractMetadata(url);
      if (!metadata) {
        errors.push(entry);
        continue;
      }

      const tab = new Tab({
        title: metadata.title,
        url: metadata.url,
        icon: metadata.icon
      });

      await tab.save();
      savedUrls.push(tab._id);
    } catch (error) {
      console.error(`Failed to save URL ${url}:`, error.message);
      errors.push(entry);
    }
  }

  if (fromMainPage) {
    return res.redirect('/');
  }

  if (errors.length && savedUrls.length === 0) {
    return res.status(500).json({ message: 'Could not save the provided URL(s)' });
  }

  return res.json({ success: true, saved: savedUrls.length, failed: errors.length });
});

app.get('/remove/:id', async (req, res) => {
  const { id } = req.params;
  await Tab.findByIdAndDelete(id);
  res.redirect('/');
});

app.get('/pin/:id', async (req, res) => {
  const { id } = req.params;
  const tab = await Tab.findById(id);

  if (!tab) {
    return res.redirect('/');
  }

  tab.pin = !tab.pin;
  await tab.save();
  res.redirect('/');
});

app.get('/removeall', async (req, res) => {
  await Tab.deleteMany({});
  res.redirect('/');
});

app.post('/add', async (req, res) => {
  res.redirect(307, '/urls');
});

app.get('/getextension', async (req, res) => {
  res.render('extension');
});
