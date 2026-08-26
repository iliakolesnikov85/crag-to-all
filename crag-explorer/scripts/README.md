# Generic SEO Patch Script

This script automatically generates and patches SEO meta tags into the built `index.html` file based on crag data.

## Features

- ✅ **Generic and reusable** - Works with any crag data
- ✅ **Data-driven** - Reads route counts and grade ranges from actual data
- ✅ **Configurable** - Easy to customize for different crags
- ✅ **Comprehensive SEO** - Includes meta tags, Open Graph, Twitter Cards, and structured data
- ✅ **Geographic SEO** - Includes location-specific meta tags
- ✅ **Smart formatting** - Rounds route counts and handles ungraded projects

## How to Use

### 1. Configure Your Crag

Edit `crag-config.js` to add your crag configuration:

```javascript
export const cragConfigs = {
  yourCrag: {
    name: "Your Crag Name",
    country: "Country Name",
    countryCode: "XX",
    region: "Region Name",
    locality: "City Name",
    url: "https://yourcrag.com",
    image: "https://yourcrag.com/header-bg.png",
    climbingType: "Bouldering", // or "Sport Climbing", "Trad Climbing"
    description: "premier climbing destination",
    rockType: "Granite", // or "Limestone", "Sandstone", etc.
    coordinates: {
      latitude: 42.123456,
      longitude: 44.123456,
      elevation: 2000
    }
  }
};

// Set your crag as default
export const defaultConfig = cragConfigs.yourCrag;
```

### 2. Prepare Your Data

Ensure your crag data follows this structure:

```json
{
  "sectors": [
    {
      "name": "Sector Name",
      "geo": "42.123456, 44.123456",
      "season": "Jul - Aug",
      "approachTime": "30min",
      "altitude": "2000m",
      "orientation": "NE",
      "routes": [
        {
          "name": "Route Name",
          "description": "Route description",
          "grade": "7A",
          "tags": ["Boulder", "Crimpers"]
        }
      ]
    }
  ]
}
```

### 3. Run the Build

The SEO patch runs automatically during the build process:

```bash
npm run build
```

## Configuration Options

| Option | Description | Example |
|--------|-------------|---------|
| `name` | Full name of the climbing area | "Roshka Climbing Area" |
| `country` | Country name | "Georgia" |
| `countryCode` | ISO country code | "GE" |
| `region` | Administrative region | "Mtskheta-Mtianeti" |
| `locality` | City/town name | "Roshka" |
| `url` | Website URL | "https://roshkaclimb.ge" |
| `image` | Social media image URL | "https://roshkaclimb.ge/header-bg.png" |
| `climbingType` | Type of climbing | "Bouldering", "Sport Climbing" |
| `description` | Brief description | "newest bouldering area" |
| `rockType` | Rock type | "Granite", "Limestone" |
| `approachFrom` | Approach description | "Abudelauri picnic area" |
| `coordinates` | GPS coordinates and elevation | `{latitude: 42.553265, longitude: 44.875476, elevation: 2500}` |
| `descriptions` | Configurable description templates | See Description Templates section below |

## Generated SEO Elements

The script automatically generates:

### Meta Tags
- Title, description, keywords
- Author, robots, language
- Geographic meta tags (geo.region, geo.position, ICBM)

### Open Graph Tags
- og:type, og:url, og:title, og:description
- og:image, og:site_name, og:locale

### Twitter Card Tags
- twitter:card, twitter:url, twitter:title
- twitter:description, twitter:image

### Structured Data (JSON-LD)
- Schema.org TouristAttraction markup
- Complete location and amenity information
- Grade ranges and route counts

## Smart Features

### Route Count Formatting
- 6 routes → "50+"
- 76 routes → "80+"
- 120 routes → "100+"

### Grade Range Calculation
- Automatically sorts grades (6A, 6B, 6C+, 7A, etc.)
- Handles ungraded projects (?)
- Shows ranges like "5+ to 8A+ (plus ungraded projects)"

### Dynamic Content
- Reads altitude from sector data
- Uses actual route counts and grades
- Generates location-specific descriptions

## Description Templates

All description strings are now configurable through the `descriptions` object in your crag configuration:

```javascript
descriptions: {
  // Main page description (meta description)
  main: "Free climbing guide for {name}, {country}'s {description}. Discover {routeCount} {climbingType} problems from {gradeRange} grades at {altitude}. Complete route descriptions, maps, and GPS coordinates.",
  
  // Open Graph and Twitter descriptions
  social: "Discover {name}, {country}'s {description} with {routeCount} problems from {gradeRange}. Free climbing guide with maps, routes, and GPS coordinates.",
  
  // Structured data description (JSON-LD)
  structured: "{name} is a {climbingType} area in {country} featuring {routeCount} {climbingType} problems ranging from {gradeRange} grades. Located at {altitude} with stunning mountain views.",
  
  // Keywords (comma-separated)
  keywords: "{name} climbing, {country} {climbingType}, {name} {climbingType}, climbing {country}, free climbing guide, {climbingType} problems, climbing routes, outdoor climbing"
}
```

### Template Variables

The following variables are automatically replaced in your description templates:

| Variable | Description | Example |
|----------|-------------|---------|
| `{name}` | Crag name | "Roshka Climbing Area" |
| `{country}` | Country name | "Georgia" |
| `{description}` | Brief description | "newest bouldering area" |
| `{routeCount}` | Formatted route count | "80+" |
| `{climbingType}` | Type of climbing | "Bouldering" |
| `{gradeRange}` | Grade range | "5+ to 8A+ (plus ungraded projects)" |
| `{altitude}` | Altitude from data | "2600m" |

## Multiple Crags

To support multiple crags, you can:

1. **Add multiple configurations** in `crag-config.js`
2. **Modify the script** to accept a crag parameter
3. **Create separate data files** for each crag

Example for multiple crags:

```javascript
// In seo-patch.js
const cragName = process.argv[2] || 'roshka';
const config = cragConfigs[cragName] || defaultConfig;
const dataPath = path.join(__dirname, `../public/data/${cragName}/${cragName}.json`);
```

## Troubleshooting

### Common Issues

1. **"crag data file not found"**
   - Check that your JSON file exists in the expected location
   - Ensure the file path in the script matches your data structure

2. **"index.html not found"**
   - Run `npm run build` first to generate the dist folder
   - Check that the build process completed successfully

3. **SEO tags not appearing**
   - Check the console output for any errors
   - Verify that the HTML patching completed successfully
   - Look for the "Successfully patched" message

### Debug Mode

Add debug logging by modifying the script:

```javascript
// Add this to see what's being generated
console.log('Generated meta tags:', metaTags);
console.log('Structured data:', JSON.stringify(generateStructuredData(cragData, config), null, 2));
```

## Examples

### Roshka Configuration
```javascript
roshka: {
  name: "Roshka Climbing Area",
  country: "Georgia",
  countryCode: "GE",
  region: "Mtskheta-Mtianeti",
  locality: "Roshka",
  url: "https://roshkaclimb.ge",
  image: "https://roshkaclimb.ge/header-bg.png",
  climbingType: "Bouldering",
  description: "newest bouldering area",
  rockType: "Granite",
  approachFrom: "Abudelauri picnic area",
  coordinates: {
    latitude: 42.553265,
    longitude: 44.875476,
    elevation: 2500
  }
}
```

### Sport Climbing Example
```javascript
sportCrag: {
  name: "Limestone Crag",
  country: "Spain",
  countryCode: "ES",
  region: "Catalonia",
  locality: "Barcelona",
  url: "https://limestonecrag.com",
  image: "https://limestonecrag.com/header.jpg",
  climbingType: "Sport Climbing",
  description: "premier sport climbing destination",
  rockType: "Limestone",
  approachFrom: "main parking lot",
  coordinates: {
    latitude: 41.3851,
    longitude: 2.1734,
    elevation: 500
  },
  descriptions: {
    main: "Comprehensive climbing guide for {name}, {country}'s {description}. Features {routeCount} {climbingType} routes from {gradeRange} grades at {altitude}. Detailed route information, maps, and coordinates.",
    social: "Explore {name}, {country}'s {description} with {routeCount} {climbingType} routes from {gradeRange}. Complete climbing guide with maps and GPS coordinates.",
    structured: "{name} is a premier {climbingType} destination in {country} offering {routeCount} routes from {gradeRange} grades. Situated at {altitude} with excellent rock quality.",
    keywords: "{name} climbing, {country} {climbingType}, {name} routes, climbing {country}, climbing guide, {climbingType} routes, outdoor climbing, rock climbing"
  }
}
``` 