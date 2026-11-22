// Pays de la carte du monde (page Strategy) : une valeur de la colonne Area (« usa », « pays-bas », « taïwan »…)
// devient un code ISO à 2 lettres, puis le nom du pays dans le fichier des frontières (world-atlas, 110m).
// Le nom affiché vient du code, dans la langue active (format.js, countryName) : la feuille n'est pas traduite.
// `at` : centre approximatif du pays [longitude, latitude], où la carte pose sa bulle.
// Pour reconnaître une nouvelle écriture, l'ajouter dans `aliases` (en minuscules, sans accents).

const COUNTRIES = {
  US: { geo: 'United States of America', at: [-98, 39], aliases: ['usa', 'us', 'united states', 'etats-unis', 'etats unis', 'america', 'amerique'] },
  CA: { geo: 'Canada', at: [-106, 56], aliases: ['canada'] },
  MX: { geo: 'Mexico', at: [-102, 23], aliases: ['mexico', 'mexique'] },
  BR: { geo: 'Brazil', at: [-52, -10], aliases: ['brazil', 'bresil'] },
  FR: { geo: 'France', at: [2.5, 46.5], aliases: ['france'] },
  DE: { geo: 'Germany', at: [10.4, 51.2], aliases: ['germany', 'allemagne'] },
  NL: { geo: 'Netherlands', at: [5.3, 52.2], aliases: ['netherlands', 'pays-bas', 'pays bas', 'holland', 'hollande'] },
  BE: { geo: 'Belgium', at: [4.5, 50.6], aliases: ['belgium', 'belgique'] },
  LU: { geo: 'Luxembourg', at: [6.1, 49.8], aliases: ['luxembourg'] },
  GB: { geo: 'United Kingdom', at: [-2, 53], aliases: ['united kingdom', 'uk', 'royaume-uni', 'royaume uni', 'great britain', 'england', 'angleterre'] },
  IE: { geo: 'Ireland', at: [-8, 53.2], aliases: ['ireland', 'irlande'] },
  CH: { geo: 'Switzerland', at: [8.2, 46.8], aliases: ['switzerland', 'suisse'] },
  IT: { geo: 'Italy', at: [12.5, 42.8], aliases: ['italy', 'italie'] },
  ES: { geo: 'Spain', at: [-3.7, 40.3], aliases: ['spain', 'espagne'] },
  PT: { geo: 'Portugal', at: [-8.2, 39.6], aliases: ['portugal'] },
  DK: { geo: 'Denmark', at: [9.5, 56], aliases: ['denmark', 'danemark'] },
  SE: { geo: 'Sweden', at: [16, 62], aliases: ['sweden', 'suede'] },
  NO: { geo: 'Norway', at: [9, 61.5], aliases: ['norway', 'norvege'] },
  FI: { geo: 'Finland', at: [26, 63], aliases: ['finland', 'finlande'] },
  AT: { geo: 'Austria', at: [14.5, 47.5], aliases: ['austria', 'autriche'] },
  PL: { geo: 'Poland', at: [19.4, 52], aliases: ['poland', 'pologne'] },
  IL: { geo: 'Israel', at: [35, 31.4], aliases: ['israel'] },
  CN: { geo: 'China', at: [104, 35], aliases: ['china', 'chine'] },
  TW: { geo: 'Taiwan', at: [121, 23.7], aliases: ['taiwan'] },
  KR: { geo: 'South Korea', at: [127.8, 36.5], aliases: ['korea', 'south korea', 'coree', 'coree du sud'] },
  JP: { geo: 'Japan', at: [138, 36.5], aliases: ['japan', 'japon'] },
  IN: { geo: 'India', at: [79, 22], aliases: ['india', 'inde'] },
  TH: { geo: 'Thailand', at: [101, 15], aliases: ['thailand', 'thailande'] },
  ID: { geo: 'Indonesia', at: [117, -2.5], aliases: ['indonesia', 'indonesie'] },
  VN: { geo: 'Vietnam', at: [106, 16], aliases: ['vietnam', 'viet nam'] },
  AU: { geo: 'Australia', at: [134, -25], aliases: ['australia', 'australie'] },
  NZ: { geo: 'New Zealand', at: [172, -41.5], aliases: ['new zealand', 'nouvelle-zelande', 'nouvelle zelande'] },
  ZA: { geo: 'South Africa', at: [24, -29], aliases: ['south africa', 'afrique du sud'] },
  AE: { geo: 'United Arab Emirates', at: [54, 24], aliases: ['united arab emirates', 'uae', 'emirats arabes unis'] },
  SA: { geo: 'Saudi Arabia', at: [45, 24], aliases: ['saudi arabia', 'arabie saoudite'] },
  AR: { geo: 'Argentina', at: [-64, -34], aliases: ['argentina', 'argentine'] },
  CL: { geo: 'Chile', at: [-71, -33], aliases: ['chile', 'chili'] },
}

const normalize = (text) =>
  String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()

const BY_ALIAS = new Map()
for (const [code, country] of Object.entries(COUNTRIES)) {
  BY_ALIAS.set(code.toLowerCase(), code)
  BY_ALIAS.set(normalize(country.geo), code)
  for (const alias of country.aliases) BY_ALIAS.set(alias, code)
}

/** Code ISO d'une valeur de la colonne Area, ou null (« world », « europe », pays inconnu : pas placé sur la carte). */
export function countryCode(area) {
  return BY_ALIAS.get(normalize(area)) ?? null
}

/** Centre approximatif du pays [longitude, latitude], pour la bulle de la carte. */
export function countryCenter(code) {
  return COUNTRIES[code]?.at ?? null
}

/** Nom du pays dans le fichier des frontières (world-atlas), pour la série « map » d'ECharts. */
export function geoName(code) {
  return COUNTRIES[code]?.geo ?? null
}
