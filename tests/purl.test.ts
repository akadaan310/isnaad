import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MISSION_SOURCE, PURL_STATE_LIMIT, checkCreate, stateMatches, urlCarriesCredential } from '../src/lib/universe/purl';

const ok = { title: 'm', kind: 'mission' as const, visibility: 'private' as const, source: MISSION_SOURCE, state: { a: 1 }, tests: [] };

test('a private mission body type-checks', () => assert.deepEqual(checkCreate(ok), { ok: true }));
test('public visibility is refused by this adapter', () => assert.equal(checkCreate({ ...ok, visibility: 'public' }).ok, false));
test('oversized state is refused', () => assert.equal(checkCreate({ ...ok, state: { x: 'a'.repeat(PURL_STATE_LIMIT) } }).ok, false));
test('a credential-looking payload is refused', () => assert.equal(checkCreate({ ...ok, state: { t: 'ghp_abcdefghijklmnop' } }).ok, false));
test('credentials never ride in URLs', () => {
  assert.equal(urlCarriesCredential('https://x.test/api/resources'), false);
  assert.equal(urlCarriesCredential('https://x.test/api?access_token=1'), true);
  assert.equal(urlCarriesCredential('not a url'), true);
});
test('read-back comparison ignores key order only', () => {
  assert.ok(stateMatches({ a: 1, b: [1, { c: 2, d: 3 }] }, { b: [1, { d: 3, c: 2 }], a: 1 }));
  assert.ok(!stateMatches({ a: 1 }, { a: 2 }));
  assert.ok(!stateMatches({ a: [1, 2] }, { a: [2, 1] }));
});
