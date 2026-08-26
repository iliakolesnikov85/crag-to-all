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

// ---------------------------------------------------------------------------
// Route count / grade range helpers (unchanged behaviour, used per-crag and
// then aggregated for the homepage)
// ---------------------------------------------------------------------------

function calculateRouteCount(totalRoutes) {
  if (totalRoutes > 500) {
    const rounded = Math.round(totalRoutes / 100) * 100;
    return `${rounded}+`;
  }
  if (totalRoutes > 100) {
    const rounded = Math.round(totalRoutes / 50) * 50;
    return `${rounded}+`;
  }
  if (totalRoutes > 0) {
    const rounded = Math.round(totalRoutes / 10) * 10;
    return `${rounded}+`;
  }
  return '0+';
}

function calculateGradeRange(routes) {
  const grades = routes.map((route) => route.grade).filter(Boolean);
  if (grades.length === 0) return 'Various';

  const gradedRoutes = grades.filter((grade) => grade !== '?');
  if (gradedRoutes.length === 0) return 'Ungraded';

  const sortedGrades = gradedRoutes.sort((a, b) => {
    const aMatch = a.match(/^(\d+)([A-Z])(\+)?$/);
    const bMatch = b.match(/^(\d+)([A-Z])(\+)?$/);
    if (!aMatch || !bMatch) return a.localeCompare(b);

    const [, aNum, aLetter, aPlus] = aMatch;
    const [, bNum, bLetter, bPlus] = bMatch;

    if (aNum !== bNum) return parseInt(aNum) - parseInt(bNum);
    if (aLetter !== bLetter) return aLetter.localeCompare(bLetter);
    if (aPlus !== bPlus) return aPlus ? 1 : -1;
    return 0;
  });

  const minGrade = sortedGrades[0];
  const maxGrade = sortedGrades[sortedGrades.length - 1];
  return minGrade === maxGrade ? minGrade : `${minGrade} to ${maxGrade}`;
}

// ---------------------------------------------------------------------------
// Firebase data loading
// ---------------------------------------------------------------------------

function getFirebaseDataUrl(cragId) {
  const bucket = process.env.FIREBASE_STORAGE_BUCKET || 'crag-to-all.firebasestorage.app';
  const useEmulator =
    process.env.SEO_PATCH_USE_FIREBASE_EMULATOR === 'true' ||
    process.env.VITE_USE_FIREBASE_EMULATOR === 'true';
  const baseUrl = useEmulator
    ? `http://localhost:9199/v0/b/${bucket}/o`
    : `https://firebasestorage.googleapis.com/v0/b/${bucket}/o`;
  const encodedPath = encodeURIComponent(`${cragId}/${cragId}.json`);
  return `${baseUrl}/${encodedPath}?alt=media`;
}

async function loadCragData(cragId) {
  const dataUrl = getFirebaseDataUrl(cragId);
  const response = await fetch(dataUrl, { headers: { 'Cache-Control': 'no-cache' } });
  if (!response.ok) {
    throw new Error(
      `Failed to fetch Firebase crag data for "${cragId}" (${response.status} ${response.statusText})`
    );
  }
  return response.json();
}

async function summarizeCrag(cragConfig) {
  try {
    const data = await loadCragData(cragConfig.cragId);
    const allRoutes = data.sectors.flatMap((sector) => sector.routes);
    return {
      ...cragConfig,
      routeCountValue: allRoutes.length,
      routeCount: calculateRouteCount(allRoutes.length),
      gradeRange: calculateGradeRange(allRoutes),
      loadFailed: false
    };
  } catch (error) {
    log(`⚠️  Could not load data for "${cragConfig.cragId}": ${error.message}`, 'yellow');
    return {
      ...cragConfig,
      routeCountValue: 0,
      routeCount: '0+',
      gradeRange: 'Various',
      loadFailed: true
    };
  }
}

function aggregateGradeRange(summaries) {
  const allGrades = summaries.flatMap((s) => {
    if (s.gradeRange === 'Various' || s.gradeRange === 'Ungraded') return [];
    if (s.gradeRange.includes(' to ')) return s.gradeRange.split(' to ');
    return [s.gradeRange];
  });
  if (allGrades.length === 0) return 'Various';
  const dummyRoutes = allGrades.map((grade) => ({ grade }));
  return calculateGradeRange(dummyRoutes);
}

// ---------------------------------------------------------------------------
// JSON-LD generation
// ---------------------------------------------------------------------------

function generateCragAttraction(summary) {
  const addressLocality = [summary.locality, ...(summary.nearby ?? [])]
    .filter(Boolean)
    .join(', ');

  return {
    "@type": "TouristAttraction",
    "name": summary.name,
    "description":
      summary.homepageBlurb ||
      `${summary.name} - ${summary.climbingType || 'Climbing'} in ${summary.country}.`,
    "url": summary.url,
    "image": summary.image,
    "address": {
      "@type": "PostalAddress",
      "addressCountry": summary.countryCode,
      "addressRegion": summary.region,
      "addressLocality": addressLocality || summary.locality
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": summary.coordinates.latitude,
      "longitude": summary.coordinates.longitude,
      "elevation": summary.coordinates.elevation
    },
    "amenityFeature": [
      {
        "@type": "LocationFeatureSpecification",
        "name": "Climbing Type",
        "value": summary.climbingType || "Bouldering"
      },
      {
        "@type": "LocationFeatureSpecification",
        "name": "Rock Type",
        "value": summary.rockType || "Granite"
      },
      {
        "@type": "LocationFeatureSpecification",
        "name": "Grade Range",
        "value": summary.gradeRange
      },
      {
        "@type": "LocationFeatureSpecification",
        "name": "Altitude",
        "value": summary.altitude
      },
      {
        "@type": "LocationFeatureSpecification",
        "name": "Season",
        "value": summary.season
      },
      {
        "@type": "LocationFeatureSpecification",
        "name": "Access",
        "value": summary.approach
      }
    ],
    "additionalProperty": [
      {
        "@type": "PropertyValue",
        "name": "Route Count",
        "value": summary.routeCount
      }
    ],
    "touristType": ["Rock Climbers", "Boulderers", "Outdoor Enthusiasts"],
    "priceRange": "Free",
    "openingHours": "Always open"
  };
}

function generateStructuredData(summaries) {
  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": siteConfig.name,
    "url": siteConfig.url,
    "description": siteConfig.description,
    "inLanguage": "en"
  };

  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": siteConfig.heading,
    "description": siteConfig.tagline,
    "url": siteConfig.url,
    "numberOfItems": summaries.length,
    "itemListElement": summaries.map((summary, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "item": generateCragAttraction(summary)
    }))
  };

  return [website, itemList];
}

// ---------------------------------------------------------------------------
// Homepage meta + HTML patching
// ---------------------------------------------------------------------------

function buildHomepageMeta(summaries) {
  const totalRouteCount = calculateRouteCount(
    summaries.reduce((sum, s) => sum + (s.routeCountValue || 0), 0)
  );
  const aggregateRange = aggregateGradeRange(summaries);

  const title = siteConfig.title;
  const description = siteConfig.description;
  const socialDescription = siteConfig.socialDescription || siteConfig.description;

  const aggregatedKeywords = [
    siteConfig.keywords,
    ...summaries.flatMap((s) => s.homepageKeywords || [])
  ]
    .filter(Boolean)
    .join(', ');

  return {
    title,
    description,
    socialDescription,
    keywords: aggregatedKeywords,
    totalRouteCount,
    aggregateRange
  };
}

function patchIndexHtml(summaries) {
  const indexPath = path.join(__dirname, '../dist/index.html');

  if (!fs.existsSync(indexPath)) {
    log('❌ index.html not found in dist directory', 'red');
    return false;
  }

  let htmlContent = fs.readFileSync(indexPath, 'utf8');

  const meta = buildHomepageMeta(summaries);
  const structuredData = generateStructuredData(summaries);

  const ogTitle = `${siteConfig.name} - Free Bouldering & Sport Climbing Guides`;

  const metaTags = [
    `<title>${meta.title}</title>`,
    `<meta name="description" content="${meta.description}">`,
    `<meta name="keywords" content="${meta.keywords}">`,
    `<meta name="author" content="Crag Explorer">`,
    `<meta name="robots" content="index, follow">`,
    `<meta name="language" content="English">`,
    `<meta name="revisit-after" content="7 days">`,

    // Open Graph tags
    `<meta property="og:type" content="website">`,
    `<meta property="og:url" content="${siteConfig.url}/">`,
    `<meta property="og:title" content="${ogTitle}">`,
    `<meta property="og:description" content="${meta.socialDescription}">`,
    `<meta property="og:image" content="${siteConfig.image}">`,
    `<meta property="og:site_name" content="${siteConfig.name}">`,
    `<meta property="og:locale" content="en_US">`,

    // Twitter tags
    `<meta property="twitter:card" content="summary_large_image">`,
    `<meta property="twitter:url" content="${siteConfig.url}/">`,
    `<meta property="twitter:title" content="${ogTitle}">`,
    `<meta property="twitter:description" content="${meta.socialDescription}">`,
    `<meta property="twitter:image" content="${siteConfig.image}">`,

    // Geographic tags - country-level for the umbrella homepage
    `<meta name="geo.region" content="${siteConfig.countryCode}">`,
    `<meta name="geo.placename" content="${siteConfig.country}">`,

    // Canonical URL
    `<link rel="canonical" href="${siteConfig.url}/">`,

    // Structured data (WebSite + ItemList of TouristAttraction)
    ...structuredData.map(
      (block) => `<script type="application/ld+json">${JSON.stringify(block)}</script>`
    )
  ].join('\n    ');

  const headMatch = htmlContent.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  if (headMatch) {
    const headContent = headMatch[1];

    let cleanedHead = headContent
      .replace(/<title>.*?<\/title>/gi, '')
      .replace(
        /<meta[^>]*(?:name|property)=["'](?:description|keywords|author|robots|language|revisit-after|og:|twitter:|geo\.|ICBM)["'][^>]*>/gi,
        ''
      )
      .replace(/<link[^>]*rel=["']canonical["'][^>]*>/gi, '')
      .replace(/<script[^>]*type=["']application\/ld\+json["'][^>]*>.*?<\/script>/gis, '');

    const insertAfter =
      cleanedHead.match(/<meta[^>]*charset[^>]*>/i) ||
      cleanedHead.match(/<meta[^>]*viewport[^>]*>/i) ||
      cleanedHead.match(/<meta[^>]*>/i);

    if (insertAfter) {
      const insertIndex = cleanedHead.indexOf(insertAfter[0]) + insertAfter[0].length;
      cleanedHead =
        cleanedHead.slice(0, insertIndex) + '\n    ' + metaTags + cleanedHead.slice(insertIndex);
    } else {
      const firstTagMatch = cleanedHead.match(/<[^>]+>/);
      if (firstTagMatch) {
        const insertIndex = cleanedHead.indexOf(firstTagMatch[0]) + firstTagMatch[0].length;
        cleanedHead =
          cleanedHead.slice(0, insertIndex) +
          '\n    ' +
          metaTags +
          cleanedHead.slice(insertIndex);
      } else {
        cleanedHead = metaTags + '\n    ' + cleanedHead;
      }
    }

    htmlContent = htmlContent.replace(headMatch[0], `<head>${cleanedHead}</head>`);
  }

  fs.writeFileSync(indexPath, htmlContent, 'utf8');
  log(
    `✅ Successfully patched index.html with "${siteConfig.name}" umbrella SEO tags`,
    'green'
  );
  log(
    `   • ${summaries.length} crag(s) listed in JSON-LD ItemList`,
    'white'
  );
  log(
    `   • Aggregated route count: ${meta.totalRouteCount}, grade range: ${meta.aggregateRange}`,
    'white'
  );

  return true;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main() {
  log('🔧 Georgia Climbing SEO Patch Script', 'blue');
  log('====================================\n', 'blue');

  const strictMode = process.env.SEO_PATCH_STRICT === 'true';
  const allCragConfigs = Object.values(cragConfigs);

  try {
    log(`☁️  Loading data for ${allCragConfigs.length} crag(s) from Firebase`, 'blue');
    const summaries = await Promise.all(allCragConfigs.map(summarizeCrag));

    summaries.forEach((s) => {
      log(
        `   • ${s.name} (${s.cragId}): ${s.routeCount} routes, ${s.gradeRange}` +
          (s.loadFailed ? ' [load failed - using fallbacks]' : ''),
        s.loadFailed ? 'yellow' : 'white'
      );
    });

    if (strictMode && summaries.some((s) => s.loadFailed)) {
      log('❌ Strict mode: at least one crag failed to load', 'red');
      return false;
    }

    return patchIndexHtml(summaries);
  } catch (error) {
    if (strictMode) {
      log(`❌ Error patching homepage SEO: ${error.message}`, 'red');
      return false;
    }
    log(`⚠️  Error patching homepage SEO, skipping: ${error.message}`, 'yellow');
    return true;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main };
