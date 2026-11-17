const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const apiRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(apiRoot, '..');
const packDir = path.join(apiRoot, '.apphosting-packs');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const sharedPackages = [
  path.join(repoRoot, 'packages', 'shared-crag'),
  path.join(repoRoot, 'packages', 'shared-firebase'),
];

function run(args, cwd) {
  execFileSync(npm, args, {
    cwd,
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
  });
}

function pack(dir) {
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  const filename = `${manifest.name.replace('@', '').replace('/', '-')}-${manifest.version}.tgz`;
  run(['pack', '--pack-destination', packDir], dir);
  const tarball = path.join(packDir, filename);
  if (!fs.existsSync(tarball)) {
    throw new Error(`npm pack did not write ${tarball}`);
  }
  return { name: manifest.name, tarball };
}

for (const dir of sharedPackages) {
  if (!fs.existsSync(path.join(dir, 'package.json'))) {
    throw new Error(
      `Shared package not found at ${dir}. The App Hosting backend root must be crag-api inside the full repository.`,
    );
  }
  run(['ci'], dir);
  run(['run', 'build'], dir);
}

run(['run', 'build'], apiRoot);

// file: dependencies are symlinks to ../packages. Node loads mongodb and
// firebase-admin from that real path, which is outside crag-api. Pack the
// built dist and install those tarballs inside this app so the runtime image
// is self-contained. package.json has to point at the tarballs; otherwise
// npm prune turns the installs back into symlinks.
fs.rmSync(packDir, { recursive: true, force: true });
fs.mkdirSync(packDir);
const packed = sharedPackages.map(pack);
const manifestPath = path.join(apiRoot, 'package.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
for (const { name, tarball } of packed) {
  const relativeTarball = path.relative(apiRoot, tarball).split(path.sep).join('/');
  manifest.dependencies[name] = `file:./${relativeTarball}`;
}
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

run(['install', '--omit=dev'], apiRoot);
run(['prune', '--omit=dev'], apiRoot);
