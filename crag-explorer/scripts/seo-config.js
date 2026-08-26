// Crag Configuration for SEO Patch Script
// Modify this file to configure SEO for different crags

// ---------------------------------------------------------------------------
// Site-level (homepage) configuration
//
// The homepage at "/" is a "Bouldering in Georgia" umbrella landing page, not a
// page about a single crag. It surfaces every crag below via JSON-LD,
// visible copy and meta keywords so Google can rank it for both general
// terms (e.g. "Georgia bouldering") and crag-specific terms
// (e.g. "Roshka bouldering", "Marneuli bouldering").
// ---------------------------------------------------------------------------

export const siteConfig = {
  url: "https://roshkaclimb.ge",
  image: "https://roshkaclimb.ge/header-bg.png",
  country: "Georgia",
  countryCode: "GE",
  name: "Bouldering in Georgia",

  // ---- Meta / JSON-LD copy (intentionally mentions sport climbing so we can
  // rank for those terms once sport-climbing content lands). ----
  tagline: "Free guidebooks for bouldering and sport climbing across Georgia",
  heading: "Bouldering & sport climbing crags in Georgia",
  title:
    "Climbing in Georgia - Free Bouldering & Sport Climbing Guides | Roshka, Shulaveri",
  description:
    "Free climbing guidebooks for Georgia: bouldering at Roshka (granite, 2500m, Kazbegi) and Shulaveri near Marneuli/Tbilisi (sandstone, winter), plus sport climbing. Topos, GPS, grades and seasons.",
  socialDescription:
    "Free climbing guidebooks for Georgia. Roshka granite bouldering in the Caucasus, Shulaveri/Marneuli sandstone winter bouldering near Tbilisi, and more.",
  keywords:
    "climbing in Georgia, Georgia bouldering, bouldering Georgia, bouldering in Georgia, climbing Georgia, Georgia climbing guide, sport climbing Georgia, Caucasus climbing, Tbilisi climbing, Georgia rock climbing, free climbing guidebook Georgia",

  // ---- Visible-page copy (no sport climbing yet; the site only has
  // bouldering content live). Currently rendered by CragSelector. ----
  visibleTagline: "Free bouldering guidebooks across Georgia",
  // Kept around for future visible use; not rendered today.
  intro:
    "Georgia (the country) has a fast-growing climbing scene: granite bouldering high in the Caucasus at Roshka, sunny winter sandstone bouldering near Tbilisi at Shulaveri and Marneuli, and developing sport-climbing crags. This site collects free, GPS-tagged guidebooks for every area below."
};

export const cragConfigs = {
  roshka: {
    cragId: "roshka",
    name: "Roshka Climbing Area",
    country: "Georgia",
    countryCode: "GE",
    region: "Mtskheta-Mtianeti",
    locality: "Roshka",
    nearby: ["Abudelauri Lakes", "Kazbegi", "Stepantsminda", "Juta"],
    url: "https://roshkaclimb.ge",
    image: "https://roshkaclimb.ge/header-bg.png",
    climbingType: "Bouldering",
    description: "new alpine bouldering crag near the Abudelauri Lakes",
    homepageBlurb:
      "Roshka - new granite alpine bouldering near the Abudelauri Lakes in the Caucasus, with high-friction rock and big new-route potential. Best from June to October.",
    homepageKeywords: [
      "Roshka bouldering",
      "Roshka climbing",
      "Roshka guidebook",
      "Abudelauri bouldering",
      "Kazbegi bouldering",
      "Caucasus bouldering",
      "granite bouldering Georgia",
      "alpine bouldering Georgia"
    ],
    rockType: "Granite",
    season: "June to October",
    altitude: "2500m",
    approach: "10-60 min of hiking from parking area",
    coordinates: {
      latitude: 42.553265,
      longitude: 44.875476,
      elevation: 2500
    },
    // Configurable description templates
    descriptions: {
      // Main page description
      main: "Free climbing guide for {name}, {country}'s {description}. Discover {routeCount} {climbingType} problems from {gradeRange} grades at {altitude}. Complete route descriptions, maps, and GPS coordinates.",
      
      // Open Graph and Twitter descriptions
      social: "Discover {name}, {country}'s {description} with {routeCount} problems from {gradeRange}. Free climbing guide with maps, routes, and GPS coordinates.",
      
      // Structured data description
      structured: "{name} is a {climbingType} area in {country} featuring {routeCount} {climbingType} problems ranging from {gradeRange} grades. Located at {altitude} with stunning mountain views.",
      
      // Keywords (comma-separated)
      keywords: "{name} climbing, {country} {climbingType}, {name} {climbingType}, climbing {country}, free climbing guide, {climbingType} problems, climbing routes, outdoor climbing"
    }
  },

  shulaveri: {
    cragId: "shulaveri",
    name: "Shulaveri Bouldering Area",
    country: "Georgia",
    countryCode: "GE",
    region: "Kvemo Kartli",
    locality: "Shulaveri",
    nearby: ["Marneuli", "Tbilisi"],
    url: "https://roshkaclimb.ge",
    image: "https://roshkaclimb.ge/header-bg.png",
    climbingType: "Bouldering",
    description: "sunny sandstone winter bouldering area near Tbilisi",
    homepageBlurb:
      "Shulaveri / Marneuli - sunny sandstone winter bouldering an hour south of Tbilisi, with very short approaches and big new-line potential.",
    homepageKeywords: [
      "Shulaveri bouldering",
      "Shulaveri climbing",
      "Shulaveri guidebook",
      "Marneuli bouldering",
      "Marneuli climbing",
      "bouldering near Tbilisi",
      "winter bouldering Georgia",
      "sandstone bouldering Tbilisi"
    ],
    rockType: "Sandstone",
    season: "Jan - Mar; Oct - Dec",
    altitude: "400m",
    approach: "Very short approaches (around 1 minute) with high development potential",
    coordinates: {
      latitude: 41.36691,
      longitude: 44.80328,
      elevation: 400
    },
    descriptions: {
      main: "Free climbing guide for {name}, {country}'s {description}. Explore {routeCount} {climbingType} problems from {gradeRange} grades at {altitude}, with short approaches and practical winter conditions.",
      social: "Discover {name} in {country}: {routeCount} {climbingType} problems from {gradeRange}, a convenient winter climbing option near Tbilisi with quick access.",
      structured: "{name} is a {climbingType} area in {country} featuring {routeCount} problems from {gradeRange} grades. The area sits around {altitude} and offers sunny winter climbing on sandstone.",
      keywords: "shulaveri bouldering, georgia bouldering, winter bouldering georgia, sandstone bouldering, shulaveri climbing, bouldering near tbilisi, climbing guide georgia"
    }
  }

  // To add a new crag, follow the shape above. The homepage-only fields are:
  //   - nearby: string[]            -> alternative locality names that fuel
  //                                    keywords like "<nearby> bouldering".
  //   - homepageBlurb: string       -> one-sentence visible copy shown on /.
  //   - homepageKeywords: string[]  -> merged into the homepage meta keywords.
};

// Default configuration (used by older code paths that still expect a single
// crag config; the homepage no longer consumes this).
export const defaultConfig = cragConfigs.roshka;
