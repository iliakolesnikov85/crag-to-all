const DEFAULT_CRAG_COUNTRY = 'GE';

interface Country {
  code: string;
  name: string;
  /** Main country domain, without the leading dot. */
  tld: string;
}

const COUNTRIES: readonly Country[] = [
  { code: 'AF', name: 'Afghanistan', tld: 'af' },
  { code: 'AX', name: 'Aland Islands', tld: 'ax' },
  { code: 'AL', name: 'Albania', tld: 'al' },
  { code: 'DZ', name: 'Algeria', tld: 'dz' },
  { code: 'AS', name: 'American Samoa', tld: 'as' },
  { code: 'AD', name: 'Andorra', tld: 'ad' },
  { code: 'AO', name: 'Angola', tld: 'ao' },
  { code: 'AI', name: 'Anguilla', tld: 'ai' },
  { code: 'AQ', name: 'Antarctica', tld: 'aq' },
  { code: 'AG', name: 'Antigua and Barbuda', tld: 'ag' },
  { code: 'AR', name: 'Argentina', tld: 'ar' },
  { code: 'AM', name: 'Armenia', tld: 'am' },
  { code: 'AW', name: 'Aruba', tld: 'aw' },
  { code: 'AU', name: 'Australia', tld: 'au' },
  { code: 'AT', name: 'Austria', tld: 'at' },
  { code: 'AZ', name: 'Azerbaijan', tld: 'az' },
  { code: 'BS', name: 'Bahamas', tld: 'bs' },
  { code: 'BH', name: 'Bahrain', tld: 'bh' },
  { code: 'BD', name: 'Bangladesh', tld: 'bd' },
  { code: 'BB', name: 'Barbados', tld: 'bb' },
  { code: 'BY', name: 'Belarus', tld: 'by' },
  { code: 'BE', name: 'Belgium', tld: 'be' },
  { code: 'BZ', name: 'Belize', tld: 'bz' },
  { code: 'BJ', name: 'Benin', tld: 'bj' },
  { code: 'BM', name: 'Bermuda', tld: 'bm' },
  { code: 'BT', name: 'Bhutan', tld: 'bt' },
  { code: 'BO', name: 'Bolivia', tld: 'bo' },
  { code: 'BQ', name: 'Bonaire, Sint Eustatius and Saba', tld: 'bq' },
  { code: 'BA', name: 'Bosnia and Herzegovina', tld: 'ba' },
  { code: 'BW', name: 'Botswana', tld: 'bw' },
  { code: 'BV', name: 'Bouvet Island', tld: 'bv' },
  { code: 'BR', name: 'Brazil', tld: 'br' },
  { code: 'IO', name: 'British Indian Ocean Territory', tld: 'io' },
  { code: 'BN', name: 'Brunei Darussalam', tld: 'bn' },
  { code: 'BG', name: 'Bulgaria', tld: 'bg' },
  { code: 'BF', name: 'Burkina Faso', tld: 'bf' },
  { code: 'BI', name: 'Burundi', tld: 'bi' },
  { code: 'CV', name: 'Cabo Verde', tld: 'cv' },
  { code: 'KH', name: 'Cambodia', tld: 'kh' },
  { code: 'CM', name: 'Cameroon', tld: 'cm' },
  { code: 'CA', name: 'Canada', tld: 'ca' },
  { code: 'KY', name: 'Cayman Islands', tld: 'ky' },
  { code: 'CF', name: 'Central African Republic', tld: 'cf' },
  { code: 'TD', name: 'Chad', tld: 'td' },
  { code: 'CL', name: 'Chile', tld: 'cl' },
  { code: 'CN', name: 'China', tld: 'cn' },
  { code: 'CX', name: 'Christmas Island', tld: 'cx' },
  { code: 'CC', name: 'Cocos (Keeling) Islands', tld: 'cc' },
  { code: 'CO', name: 'Colombia', tld: 'co' },
  { code: 'KM', name: 'Comoros', tld: 'km' },
  { code: 'CK', name: 'Cook Islands', tld: 'ck' },
  { code: 'CR', name: 'Costa Rica', tld: 'cr' },
  { code: 'CI', name: 'Côte d\'Ivoire', tld: 'ci' },
  { code: 'HR', name: 'Croatia', tld: 'hr' },
  { code: 'CU', name: 'Cuba', tld: 'cu' },
  { code: 'CW', name: 'Curaçao', tld: 'cw' },
  { code: 'CY', name: 'Cyprus', tld: 'cy' },
  { code: 'CZ', name: 'Czech Republic', tld: 'cz' },
  { code: 'CD', name: 'Democratic Republic of the Congo', tld: 'cd' },
  { code: 'DK', name: 'Denmark', tld: 'dk' },
  { code: 'DJ', name: 'Djibouti', tld: 'dj' },
  { code: 'DM', name: 'Dominica', tld: 'dm' },
  { code: 'DO', name: 'Dominican Republic', tld: 'do' },
  { code: 'EC', name: 'Ecuador', tld: 'ec' },
  { code: 'EG', name: 'Egypt', tld: 'eg' },
  { code: 'SV', name: 'El Salvador', tld: 'sv' },
  { code: 'GQ', name: 'Equatorial Guinea', tld: 'gq' },
  { code: 'ER', name: 'Eritrea', tld: 'er' },
  { code: 'EE', name: 'Estonia', tld: 'ee' },
  { code: 'SZ', name: 'Eswatini', tld: 'sz' },
  { code: 'ET', name: 'Ethiopia', tld: 'et' },
  { code: 'FK', name: 'Falkland Islands', tld: 'fk' },
  { code: 'FO', name: 'Faroe Islands', tld: 'fo' },
  { code: 'FM', name: 'Federated States of Micronesia', tld: 'fm' },
  { code: 'FJ', name: 'Fiji', tld: 'fj' },
  { code: 'FI', name: 'Finland', tld: 'fi' },
  { code: 'FR', name: 'France', tld: 'fr' },
  { code: 'GF', name: 'French Guiana', tld: 'gf' },
  { code: 'PF', name: 'French Polynesia', tld: 'pf' },
  { code: 'TF', name: 'French Southern Territories', tld: 'tf' },
  { code: 'GA', name: 'Gabon', tld: 'ga' },
  { code: 'GM', name: 'Gambia', tld: 'gm' },
  { code: 'GE', name: 'Georgia', tld: 'ge' },
  { code: 'DE', name: 'Germany', tld: 'de' },
  { code: 'GH', name: 'Ghana', tld: 'gh' },
  { code: 'GI', name: 'Gibraltar', tld: 'gi' },
  { code: 'GR', name: 'Greece', tld: 'gr' },
  { code: 'GL', name: 'Greenland', tld: 'gl' },
  { code: 'GD', name: 'Grenada', tld: 'gd' },
  { code: 'GP', name: 'Guadeloupe', tld: 'gp' },
  { code: 'GU', name: 'Guam', tld: 'gu' },
  { code: 'GT', name: 'Guatemala', tld: 'gt' },
  { code: 'GG', name: 'Guernsey', tld: 'gg' },
  { code: 'GN', name: 'Guinea', tld: 'gn' },
  { code: 'GW', name: 'Guinea-Bissau', tld: 'gw' },
  { code: 'GY', name: 'Guyana', tld: 'gy' },
  { code: 'HT', name: 'Haiti', tld: 'ht' },
  { code: 'HM', name: 'Heard Island and McDonald Islands', tld: 'hm' },
  { code: 'VA', name: 'Holy See', tld: 'va' },
  { code: 'HN', name: 'Honduras', tld: 'hn' },
  { code: 'HK', name: 'Hong Kong', tld: 'hk' },
  { code: 'HU', name: 'Hungary', tld: 'hu' },
  { code: 'IS', name: 'Iceland', tld: 'is' },
  { code: 'IN', name: 'India', tld: 'in' },
  { code: 'ID', name: 'Indonesia', tld: 'id' },
  { code: 'IR', name: 'Iran', tld: 'ir' },
  { code: 'IQ', name: 'Iraq', tld: 'iq' },
  { code: 'IE', name: 'Ireland', tld: 'ie' },
  { code: 'IM', name: 'Isle of Man', tld: 'im' },
  { code: 'IL', name: 'Israel', tld: 'il' },
  { code: 'IT', name: 'Italy', tld: 'it' },
  { code: 'JM', name: 'Jamaica', tld: 'jm' },
  { code: 'JP', name: 'Japan', tld: 'jp' },
  { code: 'JE', name: 'Jersey', tld: 'je' },
  { code: 'JO', name: 'Jordan', tld: 'jo' },
  { code: 'KZ', name: 'Kazakhstan', tld: 'kz' },
  { code: 'KE', name: 'Kenya', tld: 'ke' },
  { code: 'KI', name: 'Kiribati', tld: 'ki' },
  { code: 'KW', name: 'Kuwait', tld: 'kw' },
  { code: 'KG', name: 'Kyrgyzstan', tld: 'kg' },
  { code: 'LA', name: 'Laos', tld: 'la' },
  { code: 'LV', name: 'Latvia', tld: 'lv' },
  { code: 'LB', name: 'Lebanon', tld: 'lb' },
  { code: 'LS', name: 'Lesotho', tld: 'ls' },
  { code: 'LR', name: 'Liberia', tld: 'lr' },
  { code: 'LY', name: 'Libya', tld: 'ly' },
  { code: 'LI', name: 'Liechtenstein', tld: 'li' },
  { code: 'LT', name: 'Lithuania', tld: 'lt' },
  { code: 'LU', name: 'Luxembourg', tld: 'lu' },
  { code: 'MO', name: 'Macau', tld: 'mo' },
  { code: 'MG', name: 'Madagascar', tld: 'mg' },
  { code: 'MW', name: 'Malawi', tld: 'mw' },
  { code: 'MY', name: 'Malaysia', tld: 'my' },
  { code: 'MV', name: 'Maldives', tld: 'mv' },
  { code: 'ML', name: 'Mali', tld: 'ml' },
  { code: 'MT', name: 'Malta', tld: 'mt' },
  { code: 'MH', name: 'Marshall Islands', tld: 'mh' },
  { code: 'MQ', name: 'Martinique', tld: 'mq' },
  { code: 'MR', name: 'Mauritania', tld: 'mr' },
  { code: 'MU', name: 'Mauritius', tld: 'mu' },
  { code: 'YT', name: 'Mayotte', tld: 'yt' },
  { code: 'MX', name: 'Mexico', tld: 'mx' },
  { code: 'MD', name: 'Moldova', tld: 'md' },
  { code: 'MC', name: 'Monaco', tld: 'mc' },
  { code: 'MN', name: 'Mongolia', tld: 'mn' },
  { code: 'ME', name: 'Montenegro', tld: 'me' },
  { code: 'MS', name: 'Montserrat', tld: 'ms' },
  { code: 'MA', name: 'Morocco', tld: 'ma' },
  { code: 'MZ', name: 'Mozambique', tld: 'mz' },
  { code: 'MM', name: 'Myanmar', tld: 'mm' },
  { code: 'NA', name: 'Namibia', tld: 'na' },
  { code: 'NR', name: 'Nauru', tld: 'nr' },
  { code: 'NP', name: 'Nepal', tld: 'np' },
  { code: 'NL', name: 'Netherlands', tld: 'nl' },
  { code: 'NC', name: 'New Caledonia', tld: 'nc' },
  { code: 'NZ', name: 'New Zealand', tld: 'nz' },
  { code: 'NI', name: 'Nicaragua', tld: 'ni' },
  { code: 'NE', name: 'Niger', tld: 'ne' },
  { code: 'NG', name: 'Nigeria', tld: 'ng' },
  { code: 'NU', name: 'Niue', tld: 'nu' },
  { code: 'NF', name: 'Norfolk Island', tld: 'nf' },
  { code: 'KP', name: 'North Korea', tld: 'kp' },
  { code: 'MK', name: 'North Macedonia', tld: 'mk' },
  { code: 'MP', name: 'Northern Mariana Islands', tld: 'mp' },
  { code: 'NO', name: 'Norway', tld: 'no' },
  { code: 'OM', name: 'Oman', tld: 'om' },
  { code: 'PK', name: 'Pakistan', tld: 'pk' },
  { code: 'PW', name: 'Palau', tld: 'pw' },
  { code: 'PA', name: 'Panama', tld: 'pa' },
  { code: 'PG', name: 'Papua New Guinea', tld: 'pg' },
  { code: 'PY', name: 'Paraguay', tld: 'py' },
  { code: 'PE', name: 'Peru', tld: 'pe' },
  { code: 'PH', name: 'Philippines', tld: 'ph' },
  { code: 'PN', name: 'Pitcairn', tld: 'pn' },
  { code: 'PL', name: 'Poland', tld: 'pl' },
  { code: 'PT', name: 'Portugal', tld: 'pt' },
  { code: 'PR', name: 'Puerto Rico', tld: 'pr' },
  { code: 'QA', name: 'Qatar', tld: 'qa' },
  { code: 'CG', name: 'Republic of the Congo', tld: 'cg' },
  { code: 'RE', name: 'Réunion', tld: 're' },
  { code: 'RO', name: 'Romania', tld: 'ro' },
  { code: 'RU', name: 'Russia', tld: 'ru' },
  { code: 'RW', name: 'Rwanda', tld: 'rw' },
  { code: 'BL', name: 'Saint Barthélemy', tld: 'bl' },
  { code: 'SH', name: 'Saint Helena, Ascension and Tristan da Cunha', tld: 'sh' },
  { code: 'KN', name: 'Saint Kitts and Nevis', tld: 'kn' },
  { code: 'LC', name: 'Saint Lucia', tld: 'lc' },
  { code: 'MF', name: 'Saint Martin', tld: 'mf' },
  { code: 'PM', name: 'Saint Pierre and Miquelon', tld: 'pm' },
  { code: 'VC', name: 'Saint Vincent and the Grenadines', tld: 'vc' },
  { code: 'WS', name: 'Samoa', tld: 'ws' },
  { code: 'SM', name: 'San Marino', tld: 'sm' },
  { code: 'ST', name: 'Sao Tome and Principe', tld: 'st' },
  { code: 'SA', name: 'Saudi Arabia', tld: 'sa' },
  { code: 'SN', name: 'Senegal', tld: 'sn' },
  { code: 'RS', name: 'Serbia', tld: 'rs' },
  { code: 'SC', name: 'Seychelles', tld: 'sc' },
  { code: 'SL', name: 'Sierra Leone', tld: 'sl' },
  { code: 'SG', name: 'Singapore', tld: 'sg' },
  { code: 'SX', name: 'Sint Maarten', tld: 'sx' },
  { code: 'SK', name: 'Slovakia', tld: 'sk' },
  { code: 'SI', name: 'Slovenia', tld: 'si' },
  { code: 'SB', name: 'Solomon Islands', tld: 'sb' },
  { code: 'SO', name: 'Somalia', tld: 'so' },
  { code: 'ZA', name: 'South Africa', tld: 'za' },
  { code: 'GS', name: 'South Georgia and the South Sandwich Islands', tld: 'gs' },
  { code: 'KR', name: 'South Korea', tld: 'kr' },
  { code: 'SS', name: 'South Sudan', tld: 'ss' },
  { code: 'ES', name: 'Spain', tld: 'es' },
  { code: 'LK', name: 'Sri Lanka', tld: 'lk' },
  { code: 'PS', name: 'State of Palestine', tld: 'ps' },
  { code: 'SD', name: 'Sudan', tld: 'sd' },
  { code: 'SR', name: 'Suriname', tld: 'sr' },
  { code: 'SJ', name: 'Svalbard and Jan Mayen', tld: 'sj' },
  { code: 'SE', name: 'Sweden', tld: 'se' },
  { code: 'CH', name: 'Switzerland', tld: 'ch' },
  { code: 'SY', name: 'Syria', tld: 'sy' },
  { code: 'TW', name: 'Taiwan', tld: 'tw' },
  { code: 'TJ', name: 'Tajikistan', tld: 'tj' },
  { code: 'TZ', name: 'Tanzania', tld: 'tz' },
  { code: 'TH', name: 'Thailand', tld: 'th' },
  { code: 'TL', name: 'Timor-Leste', tld: 'tl' },
  { code: 'TG', name: 'Togo', tld: 'tg' },
  { code: 'TK', name: 'Tokelau', tld: 'tk' },
  { code: 'TO', name: 'Tonga', tld: 'to' },
  { code: 'TT', name: 'Trinidad and Tobago', tld: 'tt' },
  { code: 'TN', name: 'Tunisia', tld: 'tn' },
  { code: 'TR', name: 'Türkiye', tld: 'tr' },
  { code: 'TM', name: 'Turkmenistan', tld: 'tm' },
  { code: 'TC', name: 'Turks and Caicos Islands', tld: 'tc' },
  { code: 'TV', name: 'Tuvalu', tld: 'tv' },
  { code: 'UG', name: 'Uganda', tld: 'ug' },
  { code: 'UA', name: 'Ukraine', tld: 'ua' },
  { code: 'AE', name: 'United Arab Emirates', tld: 'ae' },
  { code: 'GB', name: 'United Kingdom', tld: 'uk' },
  { code: 'UM', name: 'United States Minor Outlying Islands', tld: 'um' },
  { code: 'US', name: 'United States of America', tld: 'us' },
  { code: 'UY', name: 'Uruguay', tld: 'uy' },
  { code: 'UZ', name: 'Uzbekistan', tld: 'uz' },
  { code: 'VU', name: 'Vanuatu', tld: 'vu' },
  { code: 'VE', name: 'Venezuela', tld: 've' },
  { code: 'VN', name: 'Vietnam', tld: 'vn' },
  { code: 'VG', name: 'Virgin Islands (British)', tld: 'vg' },
  { code: 'VI', name: 'Virgin Islands (U.S.)', tld: 'vi' },
  { code: 'WF', name: 'Wallis and Futuna', tld: 'wf' },
  { code: 'EH', name: 'Western Sahara', tld: 'eh' },
  { code: 'YE', name: 'Yemen', tld: 'ye' },
  { code: 'ZM', name: 'Zambia', tld: 'zm' },
  { code: 'ZW', name: 'Zimbabwe', tld: 'zw' },
];

/** Names people type that are not the official label. */
const COUNTRY_ALIASES: Readonly<Record<string, readonly string[]>> = {
  CG: ['Congo'],
  CI: ['Ivory Coast'],
  CZ: ['Czechia'],
  KR: ['Korea'],
  TR: ['Turkey'],
  US: ['USA', 'United States'],
};

const COUNTRY_BY_CODE = new Map(COUNTRIES.map((country) => [country.code, country]));

function fold(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function countryLabels(country: Country): string[] {
  return [country.name, ...(COUNTRY_ALIASES[country.code] ?? [])].map((label) => fold(label));
}

/** Higher is a closer match. Zero means the country does not match. */
function countryScore(country: Country, needle: string): number {
  const code = country.code.toLowerCase();
  const tld = country.tld.toLowerCase();
  const labels = countryLabels(country);
  if (code === needle) return 7;
  if (tld === needle) return 6;
  if (labels.some((label) => label === needle)) return 5;
  if (labels.some((label) => label.startsWith(needle))) return 4;
  const wordPrefix = labels.some((label) => (
    label.split(/[^a-z0-9]+/).some((word) => word.startsWith(needle))
  ));
  if (wordPrefix) return 3;
  if (code.startsWith(needle) || tld.startsWith(needle)) return 2;
  if (
    code.includes(needle)
    || tld.includes(needle)
    || labels.some((label) => label.includes(needle))
  ) return 1;
  return 0;
}

function isCountryCode(code: string): boolean {
  return COUNTRY_BY_CODE.has(code.trim().toUpperCase());
}

function countryByCode(code: string): Country | undefined {
  return COUNTRY_BY_CODE.get(code.trim().toUpperCase());
}

function searchCountries(query: string): readonly Country[] {
  const needle = fold(query).replace(/^\./, '');
  if (!needle) return COUNTRIES;
  return COUNTRIES
    .map((country, index) => ({ country, index, score: countryScore(country, needle) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => (
      b.score - a.score
      || a.country.name.length - b.country.name.length
      || a.index - b.index
    ))
    .map((row) => row.country);
}

export type { Country };

export {
  COUNTRIES,
  DEFAULT_CRAG_COUNTRY,
  countryByCode,
  isCountryCode,
  searchCountries,
};
