const { spawn, spawnSync } = require('child_process');
const crypto = require('crypto');
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
const AUTH_HOST = '127.0.0.1';
const DOWNLOAD_ACCOUNT_KIND = 'identitytoolkit#DownloadAccountResponse';

let storagePort = 9199;
let authHost = AUTH_HOST;
let authPort = 9099;
let projectId = 'crag-to-all';
let cliVersion = '13.35.1';
let committedCount = 0;
let exporting = false;
let polling = false;
let stopRequested = false;
let baselineStorage = null;
let pendingStorage = null;
let baselineAuth = null;
let pendingAuth = null;
let authWatched = false;
let authWatch = { candidate: null, polls: 0, emptySince: 0 };
let savedAuthHash = null;
let savedAuthUsers = 0;
let lastAuthErrorLog = 0;
let lastEmptyAuthLog = 0;
let dirtySince = 0;
let emulatorStatus = null;

let emulatorConfigCache;

function readEmulatorConfig() {
  if (emulatorConfigCache !== undefined) return emulatorConfigCache;
  try {
    emulatorConfigCache = JSON.parse(fs.readFileSync(path.join(pkgRoot, 'firebase.json'), 'utf8'));
  } catch (error) {
    console.warn('Could not read firebase.json:', error);
    emulatorConfigCache = null;
  }
  return emulatorConfigCache;
}

function readStoragePort() {
  const config = readEmulatorConfig();
  const port = config && config.emulators && config.emulators.storage && config.emulators.storage.port;
  if (Number.isInteger(port)) return port;
  return 9199;
}

function readAuthSettings() {
  const config = readEmulatorConfig();
  const auth = config && config.emulators && config.emulators.auth;
  if (!auth || typeof auth !== 'object') return {};
  return auth;
}

function readAuthPort() {
  const port = readAuthSettings().port;
  if (Number.isInteger(port)) return port;
  return 9099;
}

function readAuthHost() {
  const host = readAuthSettings().host;
  if (typeof host === 'string' && host.trim()) return host.trim();
  return AUTH_HOST;
}

function readProjectId() {
  try {
    const rc = JSON.parse(fs.readFileSync(path.join(pkgRoot, '.firebaserc'), 'utf8'));
    const id = rc && rc.projects && rc.projects.default;
    if (typeof id === 'string' && id.trim()) return id.trim();
  } catch (error) {
    console.warn('Could not read project id from .firebaserc:', error);
  }
  return 'crag-to-all';
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

function readCompleteExportCount(dir) {
  if (!fs.existsSync(path.join(dir, 'firebase-export-metadata.json'))) return null;
  return countExportObjects(path.join(dir, 'storage_export'));
}

function isCompleteExport(dir) {
  return readCompleteExportCount(dir) !== null;
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
  const count = readCompleteExportCount(dirs.incoming);
  if (count === null) {
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

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isDownloadAccountResponse(value) {
  if (!isPlainObject(value)) return false;
  if (value.kind !== DOWNLOAD_ACCOUNT_KIND) return false;
  if (value.users !== undefined && !Array.isArray(value.users)) return false;
  return true;
}

function isCompleteAuthExport(authExportDir) {
  const accountsPath = path.join(authExportDir, 'accounts.json');
  const configPath = path.join(authExportDir, 'config.json');
  if (!fs.existsSync(accountsPath) || !fs.existsSync(configPath)) return false;
  try {
    const accounts = JSON.parse(fs.readFileSync(accountsPath, 'utf8'));
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (!isDownloadAccountResponse(accounts)) return false;
    if (!isPlainObject(config)) return false;
    return true;
  } catch (error) {
    return false;
  }
}

function countSavedUsers(dir) {
  const accountsPath = path.join(dir, 'auth_export', 'accounts.json');
  if (!fs.existsSync(accountsPath)) return 0;
  try {
    const parsed = JSON.parse(fs.readFileSync(accountsPath, 'utf8'));
    if (!isDownloadAccountResponse(parsed) || !Array.isArray(parsed.users)) return 0;
    return parsed.users.length;
  } catch (error) {
    return 0;
  }
}

function hashAuthBodies(accounts, config) {
  return crypto.createHash('sha256').update(accounts).update('\0').update(config).digest('hex');
}

function hashAuthDir(dir) {
  const authExportDir = path.join(dir, 'auth_export');
  if (!isCompleteAuthExport(authExportDir)) return null;
  const accounts = fs.readFileSync(path.join(authExportDir, 'accounts.json'));
  const config = fs.readFileSync(path.join(authExportDir, 'config.json'));
  return hashAuthBodies(accounts, config);
}

function rememberSavedAuth() {
  savedAuthHash = hashAuthDir(liveDir);
  savedAuthUsers = countSavedUsers(liveDir);
}

function preservePreviousAuth(incomingDirectory, liveDirectory) {
  const dest = path.join(incomingDirectory, 'auth_export');
  if (isCompleteAuthExport(dest)) return true;
  fs.rmSync(dest, { recursive: true, force: true });
  const src = path.join(liveDirectory, 'auth_export');
  if (!isCompleteAuthExport(src)) return false;
  fs.cpSync(src, dest, { recursive: true });
  return isCompleteAuthExport(dest);
}

function authAccountsPath(targetProjectId, pageToken) {
  const params = new URLSearchParams();
  if (pageToken) {
    params.set('maxResults', '1000');
    params.set('nextPageToken', pageToken);
  } else {
    params.set('maxResults', '-1');
  }
  return `/identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(targetProjectId)}/accounts:batchGet?${params}`;
}

function authConfigPath(targetProjectId) {
  return `/emulator/v1/projects/${encodeURIComponent(targetProjectId)}/config`;
}

function httpGet(host, port, urlPath, timeoutMs) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      fn(value);
    };
    const request = http.get(
      {
        host,
        port,
        path: urlPath,
        headers: { Authorization: 'Bearer owner' },
      },
      (response) => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          body += chunk;
        });
        response.on('error', (error) => finish(reject, error));
        response.on('end', () => {
          if (response.statusCode >= 200 && response.statusCode < 300) {
            finish(resolve, body);
            return;
          }
          finish(
            reject,
            new Error(`Auth emulator request failed (${response.statusCode}): ${body.slice(0, 500)}`),
          );
        });
      },
    );
    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error('Auth emulator request timed out'));
    });
    request.on('error', (error) => finish(reject, error));
  });
}

function parseDownloadAccountBody(body) {
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch (error) {
    throw new Error('Auth account export was not JSON');
  }
  if (!isDownloadAccountResponse(parsed)) {
    throw new Error('Auth account export was not a download-account response');
  }
  const nextPageToken = typeof parsed.nextPageToken === 'string' ? parsed.nextPageToken : '';
  return { users: parsed.users, nextPageToken };
}

async function downloadAccounts(host, port, targetProjectId, timeoutMs) {
  const firstBody = await httpGet(host, port, authAccountsPath(targetProjectId, ''), timeoutMs);
  const first = parseDownloadAccountBody(firstBody);
  if (!first.nextPageToken) return firstBody;
  const users = Array.isArray(first.users) ? first.users.slice() : [];
  const seen = new Set();
  let pageToken = first.nextPageToken;
  let pages = 0;
  while (pageToken) {
    pages += 1;
    if (pages > 1000) throw new Error('Auth account export paginated too many times');
    if (seen.has(pageToken)) break;
    seen.add(pageToken);
    const body = await httpGet(host, port, authAccountsPath(targetProjectId, pageToken), timeoutMs);
    const page = parseDownloadAccountBody(body);
    if (Array.isArray(page.users)) users.push(...page.users);
    pageToken = page.nextPageToken;
  }
  return `${JSON.stringify({ kind: DOWNLOAD_ACCOUNT_KIND, users }, null, 2)}\n`;
}

function parseAuthConfig(body) {
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch (error) {
    throw new Error('Auth config export was not JSON');
  }
  if (!isPlainObject(parsed)) {
    throw new Error('Auth config export was not an object');
  }
  return parsed;
}

async function exportAuthToDirectory(destDir, options) {
  const host = options.host || AUTH_HOST;
  const port = options.port;
  const targetProjectId = options.projectId;
  const timeoutMs = options.timeoutMs || 60 * 1000;
  if (!targetProjectId) throw new Error('Auth export needs a project id');
  if (!Number.isInteger(port)) throw new Error('Auth export needs a port');
  const accountsBody = await downloadAccounts(host, port, targetProjectId, timeoutMs);
  const configBody = await httpGet(host, port, authConfigPath(targetProjectId), timeoutMs);
  parseAuthConfig(configBody);
  const authExport = path.join(destDir, 'auth_export');
  fs.rmSync(authExport, { recursive: true, force: true });
  fs.mkdirSync(authExport, { recursive: true });
  fs.writeFileSync(path.join(authExport, 'accounts.json'), accountsBody);
  fs.writeFileSync(path.join(authExport, 'config.json'), configBody);
}

function writeExportMetadata(dir, options) {
  const version = (options && options.version) || cliVersion;
  const metadata = { version };
  if (options && options.includeAuth) {
    metadata.auth = {
      version,
      path: 'auth_export',
    };
  }
  metadata.storage = {
    version,
    path: 'storage_export',
  };
  fs.writeFileSync(
    path.join(dir, 'firebase-export-metadata.json'),
    `${JSON.stringify(metadata, null, 2)}\n`,
  );
}

// The Auth emulator answers before import finishes. An empty list in that window
// is not a real deletion. The watch withholds the baseline, and a storage
// checkpoint must not commit the empty list until this same hold has elapsed.
function emptyAccountListIsPremature(exportedUsers, savedUsers, emptySince, now, holdMs) {
  if (exportedUsers > 0 || savedUsers <= 0) return false;
  if (!emptySince) return true;
  return now - emptySince < holdMs;
}

function keepSavedAccountsInsteadOfEmptyList(incomingDirectory, liveDirectory, savedUsers, emptySince, now, holdMs) {
  if (!emptyAccountListIsPremature(
    countSavedUsers(incomingDirectory),
    savedUsers,
    emptySince,
    now,
    holdMs,
  )) {
    return false;
  }
  const dest = path.join(incomingDirectory, 'auth_export');
  fs.rmSync(dest, { recursive: true, force: true });
  let kept = false;
  try {
    kept = preservePreviousAuth(incomingDirectory, liveDirectory);
  } catch (error) {
    console.error('Could not keep the previous auth accounts:', error);
    fs.rmSync(dest, { recursive: true, force: true });
    throw error;
  }
  if (!kept) {
    throw new Error('Refusing to replace saved auth accounts with an empty list');
  }
  return true;
}

function nextAuthWatch(watch, authState, savedUsers, now, emptyHoldMs) {
  if (!authState) {
    return { watch: { candidate: null, polls: 0, emptySince: 0 }, ready: false };
  }
  let candidate = watch.candidate;
  let polls = watch.polls;
  let emptySince = watch.emptySince;
  if (authState.hash === candidate) {
    polls += 1;
  } else {
    candidate = authState.hash;
    polls = 1;
    emptySince = 0;
  }
  const next = { candidate, polls, emptySince };
  if (authState.users === 0 && savedUsers > 0 && !next.emptySince) next.emptySince = now;
  if (emptyAccountListIsPremature(authState.users, savedUsers, next.emptySince, now, emptyHoldMs)) {
    return { watch: next, ready: false };
  }
  return { watch: next, ready: next.polls >= 2 };
}

function logAuthExportFailure(error, keptPrevious) {
  const now = Date.now();
  if (now - lastAuthErrorLog < CHECKPOINT_MS) return;
  lastAuthErrorLog = now;
  console.error('Could not export auth accounts; keeping the storage snapshot:', error);
  if (keptPrevious) console.warn('Kept the previous auth accounts in this snapshot.');
}

function logKeptEmptyAuth() {
  const now = Date.now();
  if (now - lastEmptyAuthLog < CHECKPOINT_MS) return;
  lastEmptyAuthLog = now;
  console.warn('Auth emulator returned no accounts; kept the previous accounts in this snapshot.');
}

async function readAuthState() {
  try {
    const accounts = await httpGet(authHost, authPort, authAccountsPath(projectId, ''), 2000);
    const config = await httpGet(authHost, authPort, authConfigPath(projectId), 2000);
    const parsed = parseDownloadAccountBody(accounts);
    if (parsed.nextPageToken) return null;
    JSON.parse(config);
    const users = Array.isArray(parsed.users) ? parsed.users.length : 0;
    return { hash: hashAuthBodies(accounts, config), users };
  } catch (error) {
    return null;
  }
}

function observeAuth(authState) {
  const step = nextAuthWatch(authWatch, authState, savedAuthUsers, Date.now(), CHECKPOINT_MS);
  authWatch = step.watch;
  return step.ready;
}

async function saveSnapshot(options) {
  fs.rmSync(incomingDir, { recursive: true, force: true });
  const storageExport = path.join(incomingDir, 'storage_export');
  fs.mkdirSync(storageExport, { recursive: true });
  try {
    await postExport(storageExport);
  } catch (error) {
    fs.rmSync(incomingDir, { recursive: true, force: true });
    throw error;
  }

  let authFresh = false;
  let authError = null;
  try {
    await exportAuthToDirectory(incomingDir, { host: authHost, port: authPort, projectId });
    if (!isCompleteAuthExport(path.join(incomingDir, 'auth_export'))) {
      throw new Error('Auth export is incomplete');
    }
    authFresh = true;
  } catch (error) {
    authError = error;
  }

  let includeAuth = authFresh;
  let keptPreviousAccounts = false;
  if (authFresh) {
    try {
      keptPreviousAccounts = keepSavedAccountsInsteadOfEmptyList(
        incomingDir,
        liveDir,
        savedAuthUsers,
        authWatch.emptySince,
        Date.now(),
        CHECKPOINT_MS,
      );
    } catch (error) {
      fs.rmSync(incomingDir, { recursive: true, force: true });
      throw error;
    }
    if (keptPreviousAccounts) {
      authFresh = false;
      includeAuth = true;
      logKeptEmptyAuth();
    }
  } else {
    try {
      includeAuth = preservePreviousAuth(incomingDir, liveDir);
    } catch (error) {
      console.error('Could not keep the previous auth accounts:', error);
      fs.rmSync(path.join(incomingDir, 'auth_export'), { recursive: true, force: true });
      includeAuth = false;
    }
    logAuthExportFailure(authError, includeAuth);
  }

  try {
    writeExportMetadata(incomingDir, { includeAuth, version: cliVersion });
    const count = commitImportedSnapshot(exportDirs, {
      rejectShrink: options.rejectShrink,
      committedCount,
    });
    committedCount = count;
    if (authFresh) {
      console.log(`Saved emulator snapshot (${count} files, auth accounts) to emulator-data`);
    } else if (keptPreviousAccounts) {
      console.log(`Saved emulator snapshot (${count} files, previous auth accounts) to emulator-data`);
    } else {
      console.log(`Saved emulator storage (${count} files) to emulator-data`);
    }
    return { count, authFresh };
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
  if (exporting) return null;
  exporting = true;
  try {
    return await saveSnapshot(options);
  } catch (error) {
    console.error('Could not save emulator data:', error);
    return null;
  } finally {
    exporting = false;
  }
}

function exitIfEmulatorStopped() {
  if (!emulatorStatus || exporting || stopRequested) return;
  process.exit(emulatorStatus.code);
}

async function pollEmulators() {
  if (stopRequested || exporting || polling) return;
  polling = true;
  try {
    if (!(await storageReady())) return;
    if (stopRequested || exporting) return;

    const storageSig = tempBlobSignature();
    const authState = await readAuthState();
    if (stopRequested || exporting) return;
    const authReady = observeAuth(authState);

    if (authReady && !authWatched) {
      authWatched = true;
      baselineAuth = savedAuthHash;
      pendingAuth = authState.hash;
      console.log('Watching Auth emulator accounts to save into emulator-data');
    }

    if (!storageSig) return;

    if (!baselineStorage) {
      if (storageSig === pendingStorage) {
        baselineStorage = storageSig;
        console.log('Watching Firebase Storage for changes to save into emulator-data');
      }
      pendingStorage = storageSig;
      if (!baselineStorage) return;
    }

    const storageDirty = storageSig !== baselineStorage;
    const authDirty = Boolean(authWatched && authState && authState.hash !== baselineAuth);
    if (!storageDirty && !authDirty) {
      dirtySince = 0;
      pendingStorage = storageSig;
      if (authState) pendingAuth = authState.hash;
      return;
    }

    const now = Date.now();
    if (!dirtySince) dirtySince = now;
    const storageStable = storageSig === pendingStorage;
    const authStable = !authDirty || authState.hash === pendingAuth;
    pendingStorage = storageSig;
    if (authState) pendingAuth = authState.hash;
    const due = (storageStable && authStable) || now - dirtySince >= CHECKPOINT_MS;
    if (!due || stopRequested || exporting) return;

    const saved = await beginSave({ rejectShrink: false });
    if (saved) {
      baselineStorage = storageSig;
      if (saved.authFresh && authState) {
        baselineAuth = authState.hash;
        pendingAuth = authState.hash;
        authWatched = true;
      }
      rememberSavedAuth();
      dirtySince = 0;
    }
    exitIfEmulatorStopped();
  } finally {
    polling = false;
  }
}

async function flushAndExit(child) {
  while (exporting || polling) await delay(50);
  const storagePending = Boolean(baselineStorage && pendingStorage && pendingStorage !== baselineStorage);
  const authPending = Boolean(authWatched && pendingAuth !== baselineAuth);
  if (storagePending || authPending) await beginSave({ rejectShrink: true });
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
      'Firebase emulators need Java 21+ on PATH (`java -version`) for Storage. Install a JDK and restart the terminal.',
    );
    process.exit(1);
  }
}

function main() {
  ensureJava();
  storagePort = readStoragePort();
  authHost = readAuthHost();
  authPort = readAuthPort();
  projectId = readProjectId();
  cliVersion = readCliVersion();
  recoverExportDirs(exportDirs);
  fs.mkdirSync(liveDir, { recursive: true });
  committedCount = countExportObjects(path.join(liveDir, 'storage_export')) ?? 0;
  rememberSavedAuth();

  const firebaseJs = path.join(pkgRoot, 'node_modules', 'firebase-tools', 'lib', 'bin', 'firebase.js');
  // Ctrl-C on Windows kills the process before --export-on-exit finishes, and that
  // export deletes emulator-data before the replacement is moved into place.
  // Snapshots are written while the emulator is still running instead. Auth accounts
  // are written into the same snapshot. A failed auth read must not discard storage.
  const child = spawn(
    process.execPath,
    [firebaseJs, 'emulators:start', '--only', 'auth,storage,ui', '--import=./emulator-data'],
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
    pollEmulators().catch((error) => {
      console.error('Emulator watch failed:', error);
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
    console.log('\nSaving emulator data before exit...');
    flushAndExit(child).catch((error) => {
      console.error('Failed while saving emulator data on exit:', error);
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
  exportAuthToDirectory,
  isCompleteAuthExport,
  isCompleteExport,
  emptyAccountListIsPremature,
  keepSavedAccountsInsteadOfEmptyList,
  nextAuthWatch,
  preservePreviousAuth,
  recoverExportDirs,
  writeExportMetadata,
};
