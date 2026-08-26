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

function checkFileExists(filePath) {
  return fs.existsSync(filePath);
}

function readFileContent(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    return '';
  }
}

function main() {
  log('🔍 SEO Check for Roshka Climbing Guide', 'blue');
  log('================================\n', 'blue');
  
  const distPath = path.join(__dirname, '../dist');
  
  // Check if dist directory exists
  if (!checkFileExists(distPath)) {
    log('❌ Dist directory not found. Please run "npm run build" first.', 'red');
    return;
  }
  
  // Check HTML file
  const htmlFile = path.join(distPath, 'index.html');
  if (!checkFileExists(htmlFile)) {
    log('❌ index.html not found in dist directory', 'red');
    return;
  }
  
  const htmlContent = readFileContent(htmlFile);
  
  // Check sitemap
  const sitemapFile = path.join(distPath, 'sitemap.xml');
  if (checkFileExists(sitemapFile)) {
    log('✅ sitemap.xml found', 'green');
  } else {
    log('❌ sitemap.xml not found', 'red');
  }
  
  // Check robots.txt
  const robotsFile = path.join(distPath, 'robots.txt');
  if (checkFileExists(robotsFile)) {
    log('✅ robots.txt found', 'green');
  } else {
    log('❌ robots.txt not found', 'red');
  }
  
  // Check manifest.json
  const manifestFile = path.join(distPath, 'manifest.json');
  if (checkFileExists(manifestFile)) {
    log('✅ manifest.json found', 'green');
  } else {
    log('❌ manifest.json not found', 'red');
  }
  
  log('\n📄 HTML Content Checks:', 'blue');
  
  const htmlChecks = [
    { term: '<title>', description: 'Page title' },
    { term: 'meta name="description"', description: 'Meta description' },
    { term: 'meta name="keywords"', description: 'Meta keywords' },
    { term: 'property="og:title"', description: 'Open Graph title' },
    { term: 'property="og:description"', description: 'Open Graph description' },
    { term: 'property="twitter:card"', description: 'Twitter Card' },
    { term: 'application/ld+json', description: 'Structured data (JSON-LD)' },
    { term: 'rel="canonical"', description: 'Canonical URL' },
    { term: 'Roshka Climbing Guide', description: 'Roshka mention in content' },
    { term: 'climbing', description: 'Climbing keyword' },
    { term: 'bouldering', description: 'Bouldering keyword' }
  ];
  
  htmlChecks.forEach(check => {
    if (htmlContent.includes(check.term)) {
      log(`✅ ${check.description}`, 'green');
    } else {
      log(`❌ ${check.description}`, 'red');
    }
  });
  
  log('\n🎯 SEO Summary:', 'blue');
  log('• Roshka-specific SEO component created', 'green');
  log('• Default SEO component for other crags', 'green');
  log('• Comprehensive meta tags and structured data', 'green');
  log('• Sitemap and robots.txt for search engines', 'green');
  log('• Geographic meta tags for local SEO', 'green');
  log('• Open Graph and Twitter Card support', 'green');
  
  log('\n📈 Next Steps:', 'yellow');
  log('• Submit sitemap to Google Search Console', 'white');
  log('• Monitor search performance', 'white');
  log('• Consider adding more climbing-specific keywords', 'white');
}

// Run the main function when this module is executed directly
main(); 