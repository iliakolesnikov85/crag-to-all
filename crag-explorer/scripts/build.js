import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function log(message, color = 'white') {
  const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    white: '\x1b[37m',
    reset: '\x1b[0m'
  };
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function main() {
  try {
    log('🔨 Starting build process...', 'blue');

    // shared-crag dist/ is gitignored; package main/types point at dist.
    const sharedCragRoot = path.resolve(__dirname, '../../packages/shared-crag');
    log('📦 Building @crag-to-all/shared-crag...', 'blue');
    execSync('npm ci', { cwd: sharedCragRoot, stdio: 'inherit' });
    execSync('npm run build', { cwd: sharedCragRoot, stdio: 'inherit' });
    log('✅ shared-crag build complete', 'green');
    
    // Step 1: TypeScript compilation
    log('📝 Compiling TypeScript...', 'blue');
    execSync('npx tsc', { stdio: 'inherit' });
    log('✅ TypeScript compilation complete', 'green');
    
    // Step 2: Vite build
    log('⚡ Running Vite build...', 'blue');
    execSync('npx vite build', { stdio: 'inherit' });
    log('✅ Vite build complete', 'green');
    
    // Step 3: Copy netlify.toml
    log('📋 Copying netlify.toml...', 'blue');
    const netlifySource = path.join(__dirname, '../netlify.toml');
    const netlifyDest = path.join(__dirname, '../dist/netlify.toml');
    fs.copyFileSync(netlifySource, netlifyDest);
    log('✅ netlify.toml copied', 'green');
    
    // Step 4: Generate sitemap
    log('🗺️  Generating sitemap...', 'blue');
    const { main: sitemapMain } = await import('./sitemap-generator.js');
    const sitemapResult = sitemapMain();
    
    if (sitemapResult) {
      log('✅ Sitemap generation complete', 'green');
    } else {
      log('❌ Sitemap generation failed', 'red');
      process.exit(1);
    }
    
    // Step 5: Run SEO patch
    log('🔧 Running SEO patch...', 'blue');
    const { main: seoPatchMain } = await import('./seo-patch.js');
    const seoResult = seoPatchMain();
    
    if (seoResult) {
      log('✅ SEO patch complete', 'green');
    } else {
      log('❌ SEO patch failed', 'red');
      process.exit(1);
    }
    
    log('🎉 Build process completed successfully!', 'green');
    
  } catch (error) {
    log(`❌ Build failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Run the build script
main(); 