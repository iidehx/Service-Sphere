import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  mapPasswordAuthError,
  PASSWORD_POLICY_MESSAGE,
  validatePassword,
} from '../lib/passwordPolicy.ts';
import { createDemoPasswordCredential, verifyDemoPassword } from '../lib/demoPassword.ts';

test('accepts a password that meets every requirement', () => {
  const result = validatePassword('StrongPass1!');
  assert.equal(result.isValid, true);
  assert.equal(result.message, null);
  assert.deepEqual(result.unmetRequirements, []);
});

test('accepts exactly 12 characters at the length boundary', () => {
  assert.equal(validatePassword('Abcdefghi1!x').isValid, true);
});

test('reports every unmet requirement without including the password', () => {
  const password = 'secret';
  const result = validatePassword(password);

  assert.equal(result.isValid, false);
  assert.deepEqual(
    result.unmetRequirements.map(({ key }) => key),
    ['length', 'uppercase', 'number', 'symbol'],
  );
  assert.equal(result.message, PASSWORD_POLICY_MESSAGE);
  assert.equal(result.message.includes(password), false);
});

test('requires uppercase, lowercase, number, and symbol characters', () => {
  const cases = [
    ['lowercase1!!!', 'uppercase'],
    ['UPPERCASE1!!!', 'lowercase'],
    ['NoNumber!!!!', 'number'],
    ['NoSymbol1234', 'symbol'],
  ];

  for (const [password, missing] of cases) {
    const result = validatePassword(password);
    assert.equal(result.isValid, false);
    assert.equal(result.unmetRequirements.some(({ key }) => key === missing), true);
  }
});

test('maps Firebase password policy errors to the shared policy language', () => {
  assert.equal(mapPasswordAuthError({ code: 'auth/weak-password' }), PASSWORD_POLICY_MESSAGE);
  assert.equal(
    mapPasswordAuthError({ code: 'auth/password-does-not-meet-requirements' }),
    PASSWORD_POLICY_MESSAGE,
  );
  assert.equal(mapPasswordAuthError({ code: 'auth/email-already-in-use' }), null);
});

test('demo credentials survive persistence without storing the password', () => {
  const password = 'StrongPass1!';
  const storedUser = JSON.parse(
    JSON.stringify({
      id: 'user-test',
      email: 'test@example.com',
      ...createDemoPasswordCredential(password),
    }),
  );

  assert.equal(storedUser.password, undefined);
  assert.equal(JSON.stringify(storedUser).includes(password), false);
  assert.equal(
    storedUser.passwordVerifier,
    createHash('sha256').update(`${storedUser.passwordSalt}:${password}`).digest('hex'),
  );
  assert.equal(verifyDemoPassword(password, storedUser), true);
  assert.equal(verifyDemoPassword('WrongPass1!', storedUser), false);
});