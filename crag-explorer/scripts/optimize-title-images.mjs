/**
 * Resize title JPEGs under public/images/titles/ for faster loads on CragSelector.
 * Run: node scripts/optimize-title-images.mjs
 */
import sharp from 'sharp';
import { statSync, unlinkSync, renameSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const files = ['roshka.jpg', 'shulaveri.jpg'];

const MAX_WIDTH = 800;
const JPEG_QUALITY = 80;

for (const name of files) {
  const abs = join(root, 'public', 'images', 'titles', name);
  const metaBefore = await sharp(abs).metadata();
  const bytesBefore = statSync(abs).size;
  const tmp = `${abs}.opt.tmp`;
  await sharp(abs)
    .rotate()
    .resize({
      width: MAX_WIDTH,
      withoutEnlargement: true,
      fit: 'inside',
    })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toFile(tmp);

  unlinkSync(abs);
  renameSync(tmp, abs);
  const metaAfter = await sharp(abs).metadata();
  const bytesAfter = statSync(abs).size;
  console.log(
    `${name}: ${metaBefore.width}x${metaBefore.height} → ${metaAfter.width}x${metaAfter.height}, ${bytesBefore} → ${bytesAfter} bytes`,
  );
}
