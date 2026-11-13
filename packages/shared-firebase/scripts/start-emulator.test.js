const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const http = require('http');
const {
  commitImportedSnapshot,
  countExportObjects,
  exportAuthToDirectory,
  emptyAccountListIsPremature,
  isCompleteAuthExport,
  isCompleteExport,
  keepSavedAccountsInsteadOfEmptyList,
  nextAuthWatch,
  preservePreviousAuth,
  recoverExportDirs,
  writeExportMetadata,
} = require('./start-emulator');

const DOWNLOAD_KIND = 'identitytoolkit#DownloadAccountResponse';

function writeExport(dir, ids) {
  const storageExport = path.join(dir, 'storage_export');
  fs.mkdirSync(path.join(storageExport, 'metadata'), { recursive: true });
  fs.mkdirSync(path.join(storageExport, 'blobs'), { recursive: true });
  fs.writeFileSync(path.join(storageExport, 'buckets.json'), '{"buckets":[]}\n');
  fs.writeFileSync(
    path.join(dir, 'firebase-export-metadata.json'),
    '{"version":"test","storage":{"version":"test","path":"storage_export"}}\n',
  );
  for (const id of ids) {
    fs.writeFileSync(path.join(storageExport, 'metadata', `${id}.json`), '{}\n');
    fs.writeFileSync(path.join(storageExport, 'blobs', id), id);
  }
}

function authFiles(users) {
  return {
    accounts: `${JSON.stringify({ kind: DOWNLOAD_KIND, users }, null, 2)}\n`,
    config: `${JSON.stringify({ signIn: { allowDuplicateEmails: false } }, null, 2)}\n`,
  };
}

function writeAuth(dir, users) {
  const authDir = path.join(dir, 'auth_export');
  const files = authFiles(users);
  fs.mkdirSync(authDir, { recursive: true });
  fs.writeFileSync(path.join(authDir, 'accounts.json'), files.accounts);
  fs.writeFileSync(path.join(authDir, 'config.json'), files.config);
  return files;
}

function makeDirs() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'emulator-export-'));
  return {
    root,
    live: path.join(root, 'emulator-data'),
    incoming: path.join(root, 'emulator-data-incoming'),
    previous: path.join(root, 'emulator-data-previous'),
  };
}

test('countExportObjects rejects a metadata file with no blob', () => {
  const dirs = makeDirs();
  writeExport(dirs.live, ['aaa']);
  fs.rmSync(path.join(dirs.live, 'storage_export', 'blobs', 'aaa'));
  assert.equal(countExportObjects(path.join(dirs.live, 'storage_export')), null);
  assert.equal(isCompleteExport(dirs.live), false);
  fs.rmSync(dirs.root, { recursive: true, force: true });
});

test('recoverExportDirs finishes a snapshot that was saved but not swapped in', () => {
  const dirs = makeDirs();
  writeExport(dirs.live, ['old']);
  writeExport(dirs.incoming, ['new']);
  recoverExportDirs(dirs);
  assert.equal(fs.readFileSync(path.join(dirs.live, 'storage_export', 'blobs', 'new'), 'utf8'), 'new');
  assert.equal(fs.existsSync(dirs.incoming), false);
  assert.equal(fs.existsSync(dirs.previous), false);
  fs.rmSync(dirs.root, { recursive: true, force: true });
});

test('recoverExportDirs restores the previous snapshot when the live directory is incomplete', () => {
  const dirs = makeDirs();
  fs.mkdirSync(dirs.live, { recursive: true });
  fs.writeFileSync(path.join(dirs.live, 'partial.txt'), 'x');
  writeExport(dirs.previous, ['kept']);
  recoverExportDirs(dirs);
  assert.equal(fs.readFileSync(path.join(dirs.live, 'storage_export', 'blobs', 'kept'), 'utf8'), 'kept');
  assert.equal(fs.existsSync(dirs.previous), false);
  fs.rmSync(dirs.root, { recursive: true, force: true });
});

test('commitImportedSnapshot replaces the live snapshot and drops the backup', () => {
  const dirs = makeDirs();
  writeExport(dirs.live, ['old']);
  writeExport(dirs.incoming, ['new']);
  const count = commitImportedSnapshot(dirs, { rejectShrink: false, committedCount: 1 });
  assert.equal(count, 1);
  assert.equal(fs.readFileSync(path.join(dirs.live, 'storage_export', 'blobs', 'new'), 'utf8'), 'new');
  assert.equal(fs.existsSync(dirs.incoming), false);
  assert.equal(fs.existsSync(dirs.previous), false);
  fs.rmSync(dirs.root, { recursive: true, force: true });
});

test('commitImportedSnapshot keeps the live snapshot when a shutdown export shrinks it', () => {
  const dirs = makeDirs();
  writeExport(dirs.live, ['one', 'two']);
  writeExport(dirs.incoming, ['one']);
  assert.throws(
    () => commitImportedSnapshot(dirs, { rejectShrink: true, committedCount: 2 }),
    /Refusing to replace 2 stored files with 1/,
  );
  assert.equal(fs.existsSync(path.join(dirs.live, 'storage_export', 'blobs', 'two')), true);
  assert.equal(fs.existsSync(dirs.incoming), false);
  fs.rmSync(dirs.root, { recursive: true, force: true });
});

test('commitImportedSnapshot keeps auth_export beside the storage snapshot', () => {
  const dirs = makeDirs();
  writeExport(dirs.live, ['old']);
  writeExport(dirs.incoming, ['new']);
  const files = writeAuth(dirs.incoming, [{ localId: 'local-1', email: 'ada@example.com' }]);
  commitImportedSnapshot(dirs, { rejectShrink: false, committedCount: 1 });
  assert.equal(fs.readFileSync(path.join(dirs.live, 'auth_export', 'accounts.json'), 'utf8'), files.accounts);
  assert.equal(isCompleteAuthExport(path.join(dirs.live, 'auth_export')), true);
  fs.rmSync(dirs.root, { recursive: true, force: true });
});

test('writeExportMetadata records the auth export path before the snapshot is swapped', () => {
  const dirs = makeDirs();
  fs.mkdirSync(dirs.incoming, { recursive: true });
  writeExportMetadata(dirs.incoming, { includeAuth: true, version: '13.35.1' });
  const metadata = JSON.parse(fs.readFileSync(path.join(dirs.incoming, 'firebase-export-metadata.json'), 'utf8'));
  assert.deepEqual(metadata, {
    version: '13.35.1',
    auth: { version: '13.35.1', path: 'auth_export' },
    storage: { version: '13.35.1', path: 'storage_export' },
  });
  fs.rmSync(dirs.root, { recursive: true, force: true });
});

test('preservePreviousAuth keeps storage files when the new auth export is incomplete', () => {
  const dirs = makeDirs();
  writeExport(dirs.incoming, ['blob']);
  fs.mkdirSync(path.join(dirs.incoming, 'auth_export'), { recursive: true });
  fs.writeFileSync(path.join(dirs.incoming, 'auth_export', 'accounts.json'), '{');
  const files = writeAuth(dirs.live, [{ localId: 'kept', email: 'kept@example.com' }]);
  assert.equal(preservePreviousAuth(dirs.incoming, dirs.live), true);
  assert.equal(fs.readFileSync(path.join(dirs.incoming, 'storage_export', 'blobs', 'blob'), 'utf8'), 'blob');
  assert.equal(fs.readFileSync(path.join(dirs.incoming, 'auth_export', 'accounts.json'), 'utf8'), files.accounts);
  fs.rmSync(dirs.root, { recursive: true, force: true });
});

test('preservePreviousAuth drops a partial auth export when nothing was saved before', () => {
  const dirs = makeDirs();
  writeExport(dirs.incoming, ['blob']);
  fs.mkdirSync(dirs.live, { recursive: true });
  fs.mkdirSync(path.join(dirs.incoming, 'auth_export'), { recursive: true });
  fs.writeFileSync(path.join(dirs.incoming, 'auth_export', 'accounts.json'), '{');
  assert.equal(preservePreviousAuth(dirs.incoming, dirs.live), false);
  assert.equal(fs.existsSync(path.join(dirs.incoming, 'auth_export')), false);
  assert.equal(fs.existsSync(path.join(dirs.incoming, 'storage_export', 'blobs', 'blob')), true);
  fs.rmSync(dirs.root, { recursive: true, force: true });
});

test('emptyAccountListIsPremature ignores an export that still has accounts', () => {
  assert.equal(emptyAccountListIsPremature(2, 2, 0, 1000, 50), false);
  assert.equal(emptyAccountListIsPremature(0, 0, 0, 1000, 50), false);
  assert.equal(emptyAccountListIsPremature(0, 2, 0, 1000, 50), true);
  assert.equal(emptyAccountListIsPremature(0, 2, 1000, 1020, 50), true);
  assert.equal(emptyAccountListIsPremature(0, 2, 1000, 1060, 50), false);
});

test('keepSavedAccountsInsteadOfEmptyList keeps saved accounts when a checkpoint exports none', () => {
  const dirs = makeDirs();
  writeExport(dirs.incoming, ['blob']);
  writeAuth(dirs.incoming, []);
  const files = writeAuth(dirs.live, [{ localId: 'kept', email: 'kept@example.com' }]);
  assert.equal(keepSavedAccountsInsteadOfEmptyList(dirs.incoming, dirs.live, 1, 1000, 1020, 50), true);
  assert.equal(fs.readFileSync(path.join(dirs.incoming, 'auth_export', 'accounts.json'), 'utf8'), files.accounts);
  assert.equal(fs.readFileSync(path.join(dirs.incoming, 'storage_export', 'blobs', 'blob'), 'utf8'), 'blob');
  fs.rmSync(dirs.root, { recursive: true, force: true });
});

test('keepSavedAccountsInsteadOfEmptyList accepts an empty list after the hold', () => {
  const dirs = makeDirs();
  writeExport(dirs.incoming, ['blob']);
  const empty = writeAuth(dirs.incoming, []);
  writeAuth(dirs.live, [{ localId: 'kept', email: 'kept@example.com' }]);
  assert.equal(keepSavedAccountsInsteadOfEmptyList(dirs.incoming, dirs.live, 1, 1000, 1060, 50), false);
  assert.equal(fs.readFileSync(path.join(dirs.incoming, 'auth_export', 'accounts.json'), 'utf8'), empty.accounts);
  fs.rmSync(dirs.root, { recursive: true, force: true });
});

test('nextAuthWatch waits out an empty account list while saved accounts exist', () => {
  const saved = { hash: 'saved', users: 2 };
  const empty = { hash: 'empty', users: 0 };
  let step = nextAuthWatch({ candidate: null, polls: 0, emptySince: 0 }, empty, saved.users, 1000, 50);
  assert.equal(step.ready, false);
  step = nextAuthWatch(step.watch, empty, saved.users, 1020, 50);
  assert.equal(step.ready, false);
  step = nextAuthWatch(step.watch, empty, saved.users, 1060, 50);
  assert.equal(step.ready, true);
  step = nextAuthWatch({ candidate: null, polls: 0, emptySince: 0 }, saved, saved.users, 1000, 50);
  assert.equal(step.ready, false);
  step = nextAuthWatch(step.watch, saved, saved.users, 1001, 50);
  assert.equal(step.ready, true);
});

function listen(handler) {
  const server = http.createServer((req, res) => {
    if (req.headers.authorization !== 'Bearer owner') {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end('{"error":"unauthorized"}');
      return;
    }
    handler(req, res);
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

test('exportAuthToDirectory writes the download-account response and config', async () => {
  const accounts = '{\n  "kind": "identitytoolkit#DownloadAccountResponse",\n  "users": [\n    {\n      "localId": "local-1",\n      "email": "ada@example.com",\n      "passwordHash": "fakeHash:salt=s:password=secret"\n    }\n  ]\n}';
  const config = '{\n  "signIn": {\n    "allowDuplicateEmails": false\n  }\n}';
  const seen = [];
  const server = await listen((req, res) => {
    seen.push(req.url);
    res.setHeader('Content-Type', 'application/json');
    if (req.url.startsWith('/identitytoolkit.googleapis.com/v1/projects/crag-to-all/accounts:batchGet')) {
      res.end(accounts);
      return;
    }
    if (req.url === '/emulator/v1/projects/crag-to-all/config') {
      res.end(config);
      return;
    }
    res.writeHead(404);
    res.end('missing');
  });
  const dirs = makeDirs();
  try {
    await exportAuthToDirectory(dirs.incoming, {
      host: '127.0.0.1',
      port: server.address().port,
      projectId: 'crag-to-all',
    });
    assert.equal(fs.readFileSync(path.join(dirs.incoming, 'auth_export', 'accounts.json'), 'utf8'), accounts);
    assert.equal(fs.readFileSync(path.join(dirs.incoming, 'auth_export', 'config.json'), 'utf8'), config);
    assert.equal(isCompleteAuthExport(path.join(dirs.incoming, 'auth_export')), true);
    assert.ok(seen.some((url) => url.includes('maxResults=-1')));
  } finally {
    await closeServer(server);
    fs.rmSync(dirs.root, { recursive: true, force: true });
  }
});

test('exportAuthToDirectory merges paged download-account responses', async () => {
  const server = await listen((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    res.setHeader('Content-Type', 'application/json');
    if (url.pathname.endsWith('/config')) {
      res.end('{"signIn":{"allowDuplicateEmails":false}}');
      return;
    }
    const token = url.searchParams.get('nextPageToken');
    if (!token) {
      res.end(JSON.stringify({
        kind: DOWNLOAD_KIND,
        users: [{ localId: 'a', email: 'a@example.com' }],
        nextPageToken: 'a',
      }));
      return;
    }
    res.end(JSON.stringify({
      kind: DOWNLOAD_KIND,
      users: [{ localId: 'b', email: 'b@example.com' }],
    }));
  });
  const dirs = makeDirs();
  try {
    await exportAuthToDirectory(dirs.incoming, {
      host: '127.0.0.1',
      port: server.address().port,
      projectId: 'crag-to-all',
    });
    const accounts = JSON.parse(fs.readFileSync(path.join(dirs.incoming, 'auth_export', 'accounts.json'), 'utf8'));
    assert.equal(accounts.kind, DOWNLOAD_KIND);
    assert.deepEqual(accounts.users.map((user) => user.localId), ['a', 'b']);
    assert.equal(accounts.nextPageToken, undefined);
  } finally {
    await closeServer(server);
    fs.rmSync(dirs.root, { recursive: true, force: true });
  }
});

test('exportAuthToDirectory leaves storage in place when the account export fails', async () => {
  const server = await listen((req, res) => {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end('{"error":"down"}');
  });
  const dirs = makeDirs();
  writeExport(dirs.incoming, ['blob']);
  try {
    await assert.rejects(
      () => exportAuthToDirectory(dirs.incoming, {
        host: '127.0.0.1',
        port: server.address().port,
        projectId: 'crag-to-all',
      }),
      /Auth emulator request failed \(500\)/,
    );
    assert.equal(fs.existsSync(path.join(dirs.incoming, 'auth_export', 'accounts.json')), false);
    assert.equal(fs.readFileSync(path.join(dirs.incoming, 'storage_export', 'blobs', 'blob'), 'utf8'), 'blob');
  } finally {
    await closeServer(server);
    fs.rmSync(dirs.root, { recursive: true, force: true });
  }
});
