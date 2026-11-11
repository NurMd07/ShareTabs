const { timingSafeEqual } = require('crypto');

const matchesCredential = (provided, expected) => {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);

  return providedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(providedBuffer, expectedBuffer);
};

const validateExtensionAuthorization = (authorization, expectedUsername, expectedPassword) => {
  if (!expectedUsername || !expectedPassword) {
    return 'unavailable';
  }

  const match = /^Basic\s+([A-Za-z0-9+/]+={0,2})$/i.exec(authorization || '');
  if (!match) {
    return 'unauthorized';
  }

  const credentials = Buffer.from(match[1], 'base64').toString('utf8');
  const separator = credentials.indexOf(':');
  if (separator < 0) {
    return 'unauthorized';
  }

  const usernameMatches = matchesCredential(credentials.slice(0, separator), expectedUsername);
  const passwordMatches = matchesCredential(credentials.slice(separator + 1), expectedPassword);

  return usernameMatches && passwordMatches ? null : 'unauthorized';
};

module.exports = validateExtensionAuthorization;
