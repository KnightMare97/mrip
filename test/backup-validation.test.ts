import assert from 'node:assert/strict';
import test from 'node:test';
import { validateBackup } from '../src/services/storage/IndexedDBRepository';

const base = () => ({ schemaVersion: 1, exportedAt: '', generator: 'test', favorites: [], watchlist: [], searchHistory: [], recentlyViewed: [], preferences: { historySearchEnabled: true, historyViewEnabled: true, catalogSource: 'ytmusic', preferredFormat: 'MP3' } });
test('backup validation rejects invalid schema and records before database access', () => {
  assert.throws(() => validateBackup({ ...base(), schemaVersion: 9 }));
  assert.throws(() => validateBackup({ ...base(), favorites: [{ id: 'incomplete' }] }));
  assert.throws(() => validateBackup({ ...base(), preferences: { historySearchEnabled: 'yes' } }));
});
test('backup validation deduplicates and discards unknown secret fields', () => {
  const record = { id: 'live:ytmusic:artist:one', namespace: 'live', provider: 'ytmusic', entityType: 'artist', stableProviderId: 'one', title: 'Artist', addedAt: 1, token: 'must-not-be-imported' };
  const result = validateBackup({ ...base(), token: 'top-level-secret', favorites: [record, { ...record, title: 'Updated Artist' }] });
  assert.equal(result.favorites.length, 1); assert.equal(result.favorites[0].title, 'Updated Artist');
  assert.equal('token' in result.favorites[0], false); assert.equal('token' in result, false);
});
test('backup validation rejects unsafe artwork and invalid namespace', () => {
  const record = { id: 'item', namespace: 'live', provider: 'ytmusic', entityType: 'artist', stableProviderId: 'one', title: 'Artist', addedAt: 1 };
  assert.throws(() => validateBackup({ ...base(), favorites: [{ ...record, coverUrl: 'javascript:alert(1)' }] }));
  assert.throws(() => validateBackup({ ...base(), favorites: [{ ...record, namespace: 'unexpected' }] }));
  assert.throws(() => validateBackup({ ...base(), favorites: [{ ...record, metadata: { trackNumber: 'bad' } }] }));
});
