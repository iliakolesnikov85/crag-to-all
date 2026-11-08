const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const {
  commitImportedSnapshot,
  countExportObjects,
  isCompleteExport,
  recoverExportDirs,
} = require('./start-emulator');

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
