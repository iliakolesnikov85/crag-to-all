const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const pkgRoot = path.join(__dirname, '..');
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

fs.mkdirSync(path.join(pkgRoot, 'emulator-data'), { recursive: true });

const firebaseJs = path.join(
  pkgRoot,
  'node_modules',
  'firebase-tools',
  'lib',
  'bin',
  'firebase.js',
);

const child = spawn(
  process.execPath,
  [
    firebaseJs,
    'emulators:start',
    '--only',
    'storage,ui',
    '--import=./emulator-data',
    '--export-on-exit=./emulator-data',
  ],
  {
    cwd: pkgRoot,
    stdio: 'inherit',
  },
);

child.on('error', (error) => {
  console.error('Failed to start Firebase emulators:', error);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
