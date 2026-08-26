import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { cragConfigs, siteConfig } from './seo-config.js';

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

// Only the homepage is treated as an SEO landing page. The per-crag SPA
// sub-routes (overview/routes/map/description/download) all serve the same
// client-rendered shell whose canonical points back to the homepage, so
// listing them here would contradict that canonical and just produce
// "Duplicate, Google chose a different canonical" noise in Search Console.
function renderUrl({ loc, lastmod, changefreq, priority }) {
  return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

function generateSitemap() {
  const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const base = siteConfig.url.replace(/\/$/, '');

  const homepage = {
    loc: `${base}/`,
    lastmod: currentDate,
    changefreq: 'weekly',
    priority: '1.0'
  };

  const allUrls = [homepage];

  const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls.map(renderUrl).join('\n')}
</urlset>`;

  return { sitemapContent, urlCount: allUrls.length };
}

function main() {
  try {
    log('🗺️  Generating sitemap with current build date...', 'blue');

    const { sitemapContent, urlCount } = generateSitemap();
    // Write to public/ so dev mode (`vite dev`) serves it, and to dist/ so
    // the current build's deploy contains the up-to-date file. Without the
    // dist/ write the sitemap would always be one build behind, because
    // vite build copies public/ -> dist/ before this script runs.
    const publicPath = path.join(__dirname, '../public/sitemap.xml');
    const distPath = path.join(__dirname, '../dist/sitemap.xml');

    fs.writeFileSync(publicPath, sitemapContent, 'utf8');
    if (fs.existsSync(path.dirname(distPath))) {
      fs.writeFileSync(distPath, sitemapContent, 'utf8');
    }

    log('✅ Sitemap generated successfully', 'green');
    log(`📅 Updated with date: ${new Date().toISOString().split('T')[0]}`, 'green');
    log(`🔗 ${urlCount} URL(s) listed (${Object.keys(cragConfigs).length} crag(s))`, 'green');

    return true;
  } catch (error) {
    log(`❌ Failed to generate sitemap: ${error.message}`, 'red');
    return false;
  }
}

export { main, generateSitemap };

if (process.argv[1] && process.argv[1].endsWith('sitemap-generator.js')) {
  main();
}
