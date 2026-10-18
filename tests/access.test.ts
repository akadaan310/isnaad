import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideAccess, presented, safeEqual } from '../src/lib/access';

const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');
const dec = (s: string) => Buffer.from(s, 'base64').toString('utf8');

test('private by default in production', () => {
  assert.deepEqual(decideAccess({ NODE_ENV: 'production' }, null, dec), { allow: false, status: 503, reason: 'not-configured' });
});
test('development is open to the local machine', () => {
  assert.equal(decideAccess({ NODE_ENV: 'development' }, null, dec).allow, true);
});
test('public only by explicit operator choice', () => {
  assert.deepEqual(decideAccess({ NODE_ENV: 'production', STUDIO_ALLOW_PUBLIC: '1' }, null, dec), { allow: true, reason: 'public-by-operator' });
  assert.equal(decideAccess({ NODE_ENV: 'production', STUDIO_ALLOW_PUBLIC: 'true' }, null, dec).allow, false);
});
test('a configured token is required everywhere, development included', () => {
  const env = { NODE_ENV: 'development', STUDIO_ACCESS_TOKEN: 's3cret' };
  assert.deepEqual(decideAccess(env, null, dec), { allow: false, status: 401, reason: 'no-credentials' });
  assert.deepEqual(decideAccess(env, `Basic ${b64('abed:wrong')}`, dec), { allow: false, status: 401, reason: 'bad-credentials' });
  assert.deepEqual(decideAccess(env, `Basic ${b64('7u:s3cret')}`, dec), { allow: true, reason: 'token' });
  assert.deepEqual(decideAccess(env, 'Bearer s3cret', dec), { allow: true, reason: 'token' });
  assert.equal(decideAccess(env, 'Bearer s3cret2', dec).allow, false);
  assert.equal(decideAccess(env, 'Digest s3cret', dec).allow, false);
});
test('presented() and safeEqual()', () => {
  assert.equal(presented(`Basic ${b64('a:b:c')}`, dec), 'b:c');
  assert.equal(presented('Basic', dec), null);
  assert.equal(safeEqual('abc', 'abc'), true);
  assert.equal(safeEqual('abc', 'abd'), false);
  assert.equal(safeEqual('abc', 'abcd'), false);
  assert.equal(safeEqual('', ''), true);
});
