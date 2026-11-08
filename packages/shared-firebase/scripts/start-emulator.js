const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const pkgRoot = path.join(__dirname, '..');
const liveDir = path.join(pkgRoot, 'emulator-data');
const incomingDir = path.join(pkgRoot, 'emulator-data-incoming');
const previousDir = path.join(pkgRoot, 'emulator-data-previous');
const exportDirs = { live: liveDir, incoming: incomingDir, previous: previousDir };

const POLL_MS = 2000;
const CHECKPOINT_MS = 20000;
const STORAGE_HOST = '127.0.0.1';

let storagePort = 9199;
let cliVersion = '13.35.1';
let committedCount = 0;
let exporting = false;
let stopRequested = false;
let baselineSignature = null;
let pendingSignature = null;
let dirtySince = 0;
let emulatorStatus = null;

function readStoragePort() {
  try {
    const config = JSON.parse(fs.readFileSync(path.join(pkgRoot, 'firebase.json'), 'utf8'));
    const port = config && config.emulators && config.emulators.storage && config.emulators.storage.port;
    if (Number.isInteger(port)) return port;
  } catch (error) {
    console.warn('Could not read storage emulator port from firebase.json:', error);
  }
  return 9199;
}

function readCliVersion() {
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(pkgRoot, 'node_modules', 'firebase-tools', 'package.json'), 'utf8'),
    );
    if (typeof pkg.version === 'string' && pkg.version.trim()) return pkg.version.trim();
  } catch (error) {
    console.warn('Could not read firebase-tools version:', error);
  }
  return '13.35.1';
}

function countExportObjects(storageExportDir) {
  const metadataDir = path.join(storageExportDir, 'metadata');
  const blobsDir = path.join(storageExportDir, 'blobs');
  if (!fs.existsSync(metadataDir) || !fs.existsSync(blobsDir)) return null;
  if (!fs.existsSync(path.join(storageExportDir, 'buckets.json'))) return null;
  let metas;
  let blobs;
  try {
    metas = fs.readdirSync(metadataDir).filter((name) => name.endsWith('.json'));
    blobs = new Set(fs.readdirSync(blobsDir));
  } catch (error) {
    console.warn(`Could not read storage export at ${storageExportDir}:`, error);
    return null;
  }
  for (const meta of metas) {
    const id = meta.slice(0, -'.json'.length);
    if (!blobs.has(id)) return null;
  }
  return metas.length;
}

function isCompleteExport(dir) {
  if (!fs.existsSync(path.join(dir, 'firebase-export-metadata.json'))) return false;
  return countExportObjects(path.join(dir, 'storage_export')) !== null;
}

function recoverExportDirs(dirs) {
  if (isCompleteExport(dirs.incoming)) {
    fs.rmSync(dirs.previous, { recursive: true, force: true });
    if (fs.existsSync(dirs.live)) fs.renameSync(dirs.live, dirs.previous);
    fs.renameSync(dirs.incoming, dirs.live);
    fs.rmSync(dirs.previous, { recursive: true, force: true });
    return;
  }
  if (!isCompleteExport(dirs.live) && isCompleteExport(dirs.previous)) {
    fs.rmSync(dirs.live, { recursive: true, force: true });
    fs.renameSync(dirs.previous, dirs.live);
  }
  if (isCompleteExport(dirs.live)) {
    fs.rmSync(dirs.incoming, { recursive: true, force: true });
    fs.rmSync(dirs.previous, { recursive: true, force: true });
  }
}

function commitImportedSnapshot(dirs, options) {
  const count = countExportObjects(path.join(dirs.incoming, 'storage_export'));
  const metadataReady = fs.existsSync(path.join(dirs.incoming, 'firebase-export-metadata.json'));
  if (count === null || !metadataReady) {
    throw new Error('Storage export is incomplete');
  }
  if (options.rejectShrink && options.committedCount > 0 && count < options.committedCount) {
    fs.rmSync(dirs.incoming, { recursive: true, force: true });
    throw new Error(`Refusing to replace ${options.committedCount} stored files with ${count}`);
  }
  fs.rmSync(dirs.previous, { recursive: true, force: true });
  if (fs.existsSync(dirs.live)) fs.renameSync(dirs.live, dirs.previous);
  try {
    fs.renameSync(dirs.incoming, dirs.live);
  } catch (error) {
    console.error('Could not move the new emulator snapshot into place:', error);
    if (!fs.existsSync(dirs.live) && fs.existsSync(dirs.previous)) {
      fs.renameSync(dirs.previous, dirs.live);
    }
    throw error;
  }
  fs.rmSync(dirs.previous, { recursive: true, force: true });
  return count;
}

function tempBlobSignature() {
  const dir = path.join(os.tmpdir(), 'firebase', 'storage', 'blobs');
  if (!fs.existsSync(dir)) return null;
  let names;
  try {
    names = fs.readdirSync(dir);
  } catch (error) {
    console.warn('Could not read the storage emulator temp directory:', error);
    return null;
  }
  let bytes = 0;
  let newest = 0;
  let files = 0;
  for (const name of names) {
    try {
      const stat = fs.statSync(path.join(dir, name));
      if (!stat.isFile()) continue;
      files += 1;
      bytes += stat.size;
      if (stat.mtimeMs > newest) newest = stat.mtimeMs;
    } catch (error) {
      console.warn(`Could not stat storage temp file ${name}:`, error);
    }
  }
  return `${files}:${bytes}:${newest}`;
}

function postExport(storageExportPath) {
  const payload = JSON.stringify({ path: storageExportPath, initiatedBy: 'wrapper' });
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        host: STORAGE_HOST,
        port: storagePort,
        path: '/internal/export',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (response) => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          body += chunk;
        });
        response.on('end', () => {
          if (response.statusCode >= 200 && response.statusCode < 300) {
            resolve();
            return;
          }
          reject(new Error(`Storage export failed (${response.statusCode}): ${body}`));
        });
      },
    );
    request.setTimeout(5 * 60 * 1000, () => {
      request.destroy(new Error('Storage export timed out'));
    });
    request.on('error', reject);
    request.write(payload);
    request.end();
  });
}

function writeExportMetadata(dir) {
  const metadata = {
    version: cliVersion,
    storage: {
      version: cliVersion,
      path: 'storage_export',
    },
  };
  fs.writeFileSync(
    path.join(dir, 'firebase-export-metadata.json'),
    `${JSON.stringify(metadata, null, 2)}\n`,
  );
}

async function saveSnapshot(options) {
  fs.rmSync(incomingDir, { recursive: true, force: true });
  const storageExport = path.join(incomingDir, 'storage_export');
  fs.mkdirSync(storageExport, { recursive: true });
  try {
    await postExport(storageExport);
    writeExportMetadata(incomingDir);
    const count = commitImportedSnapshot(exportDirs, {
      rejectShrink: options.rejectShrink,
      committedCount,
    });
    committedCount = count;
    console.log(`Saved emulator storage (${count} files) to emulator-data`);
    return count;
  } catch (error) {
    fs.rmSync(incomingDir, { recursive: true, force: true });
    throw error;
  }
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function storageReady() {
  return new Promise((resolve) => {
    const request = http.get({ host: STORAGE_HOST, port: storagePort, path: '/' }, (response) => {
      response.resume();
      resolve(true);
    });
    request.setTimeout(1000, () => {
      request.destroy();
      resolve(false);
    });
    request.on('error', () => resolve(false));
  });
}

async function beginSave(options) {
  if (exporting) return false;
  exporting = true;
  try {
    await saveSnapshot(options);
    return true;
  } catch (error) {
    console.error('Could not save emulator storage:', error);
    return false;
  } finally {
    exporting = false;
  }
}

function exitIfEmulatorStopped() {
  if (!emulatorStatus || exporting || stopRequested) return;
  process.exit(emulatorStatus.code);
}

async function pollStorage() {
  if (stopRequested || exporting) return;
  if (!(await storageReady())) return;
  if (stopRequested || exporting) return;
  const signature = tempBlobSignature();
  if (!signature) return;
  if (!baselineSignature) {
    if (signature === pendingSignature) {
      baselineSignature = signature;
      console.log('Watching Firebase Storage for changes to save into emulator-data');
    }
    pendingSignature = signature;
    return;
  }
  if (signature === baselineSignature) {
    dirtySince = 0;
    pendingSignature = signature;
    return;
  }
  const now = Date.now();
  if (!dirtySince) dirtySince = now;
  const unchanged = signature === pendingSignature;
  pendingSignature = signature;
  const due = unchanged || now - dirtySince >= CHECKPOINT_MS;
  if (!due || stopRequested || exporting) return;
  const saved = await beginSave({ rejectShrink: false });
  if (saved) {
    baselineSignature = signature;
    dirtySince = 0;
  }
  exitIfEmulatorStopped();
}

async function flushAndExit(child) {
  while (exporting) await delay(50);
  const pending = Boolean(baselineSignature && pendingSignature && pendingSignature !== baselineSignature);
  if (pending) await beginSave({ rejectShrink: true });
  if (child.exitCode === null && child.signalCode === null) {
    child.kill();
  }
  process.exit(emulatorStatus ? emulatorStatus.code : 0);
}

function ensureJava() {
  const javaCheck = spawnSync('java', ['-version'], {
    encoding: 'utf8',
    windowsHide: true,
  });
  if (javaCheck.error) {
    console.error(
      'Firebase Storage emulator needs Java 21+ on PATH (`java -version`). Install a JDK and restart the terminal.',
    );
    process.exit(1);
  }
}

function main() {
  ensureJava();
  storagePort = readStoragePort();
  cliVersion = readCliVersion();
  recoverExportDirs(exportDirs);
  fs.mkdirSync(liveDir, { recursive: true });
  committedCount = countExportObjects(path.join(liveDir, 'storage_export')) ?? 0;

  const firebaseJs = path.join(pkgRoot, 'node_modules', 'firebase-tools', 'lib', 'bin', 'firebase.js');
  // Ctrl-C on Windows kills the process before --export-on-exit finishes, and that
  // export deletes emulator-data before the replacement is moved into place.
  // Snapshots are written while the emulator is still running instead.
  const child = spawn(
    process.execPath,
    [firebaseJs, 'emulators:start', '--only', 'storage,ui', '--import=./emulator-data'],
    {
      cwd: pkgRoot,
      stdio: 'inherit',
    },
  );

  child.on('error', (error) => {
    console.error('Failed to start Firebase emulators:', error);
    process.exit(1);
  });

  child.on('exit', (code) => {
    emulatorStatus = { code: code ?? 1 };
    exitIfEmulatorStopped();
  });

  const timer = setInterval(() => {
    pollStorage().catch((error) => {
      console.error('Storage watch failed:', error);
    });
  }, POLL_MS);
  timer.unref();

  const requestStop = () => {
    if (stopRequested) {
      console.error('Forced stop.');
      child.kill();
      process.exit(1);
    }
    stopRequested = true;
    console.log('\nSaving emulator storage before exit...');
    flushAndExit(child).catch((error) => {
      console.error('Failed while saving emulator storage on exit:', error);
      process.exit(emulatorStatus ? emulatorStatus.code : 1);
    });
  };

  process.on('SIGINT', requestStop);
  process.on('SIGTERM', requestStop);
}

if (require.main === module) {
  main();
}

module.exports = {
  commitImportedSnapshot,
  countExportObjects,
  isCompleteExport,
  recoverExportDirs,
};
