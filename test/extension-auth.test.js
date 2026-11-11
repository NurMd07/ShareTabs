const test = require('node:test');
const assert = require('node:assert/strict');

const validateExtensionAuthorization = require('../utils/extension-auth');

const basicAuthorization = (username, password) =>
  `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;

test('accepts matching extension credentials', () => {
  assert.equal(
    validateExtensionAuthorization(basicAuthorization('user', 'pass'), 'user', 'pass'),
    null
  );
});

test('rejects missing and incorrect extension credentials', () => {
  assert.equal(validateExtensionAuthorization(undefined, 'user', 'pass'), 'unauthorized');
  assert.equal(
    validateExtensionAuthorization(basicAuthorization('user', 'wrong'), 'user', 'pass'),
    'unauthorized'
  );
});

test('reports missing server credentials as unavailable', () => {
  assert.equal(
    validateExtensionAuthorization(basicAuthorization('user', 'pass'), 'user', ''),
    'unavailable'
  );
});
