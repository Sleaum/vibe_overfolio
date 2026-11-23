import { CHART_COLORS, COLORS } from './theme.js'

import { ref } from 'vue'
import { saveProfileAssetColors } from './api.js'
import { readPreference, writePreference } from './preferences.js'

// Couleurs des graphiques, dans l'esprit des couleurs Google :
// - types d'actifs : une teinte vive par type (ASSET_SWATCHES), choisie type par type dans le menu de Charts ;
// - tout le reste : des nuances de bleu (BLUES), du plus foncé au plus clair ;
// - montants négatifs (baisses, sorties, dettes) : des couleurs chaudes de la même famille (NEGATIVE, NEGATIVE_2).

/** Nuances de bleu, de la plus foncée à la plus claire. */
export const BLUES = [
  '#174ea6', // 1 bleu nuit
  '#185abc',
  '#1967d2',
  '#1a73e8', // 4 bleu principal
  '#4285f4',
  '#669df6',
  '#8ab4f8',
  '#aecbfa', // 8 bleu pâle
]

/** Bleu principal : une seule série, une ligne, une carte. */
export const BLUE = BLUES[3]
/** Bleu nuit : repère posé sur du bleu (tendance, objectif, bulles de la carte). */
export const NAVY = BLUES[0]
/** Bleu pâle : barres sous une ligne de tendance. */
export const PALE_BLUE = BLUES[6]

/** Montants négatifs : rouge (baisse, sortie, dette), orange (second montant négatif, comme les impôts). */
export const NEGATIVE = '#d93025'
export const NEGATIVE_2 = '#e8710a'

/** Nuances de rouge, de la plus foncée à la plus claire : montants négatifs de plusieurs séries (une par série). */
export const REDS = [
  '#a50e0e',
  '#b31412',
  '#c5221f',
  '#d93025', // NEGATIVE
  '#ea4335',
  '#ee675c',
  '#f28b82',
  '#f6aea9',
]

/** `count` nuances de rouge, comme blues() : la série i a son bleu (hausse) et son rouge (baisse). */
export function reds(count) {
  const n = Math.max(1, Math.min(count, REDS.length))
  if (n === 1) return [NEGATIVE]
  return Array.from({ length: n }, (_, i) => REDS[Math.round((i * (REDS.length - 1)) / (n - 1))])
}

/**
 * `count` nuances de bleu bien séparées, de la plus foncée à la plus claire (au plus BLUES.length).
 * La première catégorie (la plus grosse) est la plus foncée.
 */
export function blues(count) {
  const n = Math.max(1, Math.min(count, BLUES.length))
  if (n === 1) return [BLUE]
  return Array.from({ length: n }, (_, i) => BLUES[Math.round((i * (BLUES.length - 1)) / (n - 1))])
}

// Série de contexte (courbes secondaires, « Autres »)
export const CONTEXT = '#898781'

// Surfaces, encres et ombres des graphiques : valeurs claires de lib/theme.js (seule source).
// Les graphiques sont toujours construits avec ces valeurs ; BaseChart.vue les remplace par DARK en mode sombre.
export const SURFACE = COLORS.paper.light
export const INK = COLORS.ink.light
export const INK_2 = COLORS['ink-2'].light
export const GRID = COLORS.line.light
export const AXIS = COLORS['line-strong'].light
export const HOVER_SHADE = CHART_COLORS.hoverShade.light
export const TOOLTIP_SHADOW = CHART_COLORS.tooltipShadow.light

// Mode sombre : chaque valeur claire ci-dessus → sa valeur sombre (lib/chartDark.js)
const pair = ({ light, dark }) => [light, dark]
export const DARK = Object.fromEntries([
  pair(COLORS.paper),
  pair(COLORS.ink),
  pair(COLORS['ink-2']),
  pair(COLORS.line),
  pair(COLORS['line-strong']),
  pair(CHART_COLORS.hoverShade),
  pair(CHART_COLORS.tooltipShadow),
])

export const FONT =
  'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'

// Types d'actifs : une couleur par type, la même dans l'anneau, dans les barres empilées et partout ailleurs.
// ASSET_ORDER fixe l'ordre d'affichage des types habituels.
export const ASSET_ORDER = [
  'public equity',
  'real estate',
  'fiat',
  'crypto',
  'commodity',
  'managed futures',
  'exotic',
  'depreciating',
]

/** Teintes proposées pour les types d'actifs : 8 teintes Google, en vif puis en clair. */
export const ASSET_SWATCHES = [
  { hue: 'blue', light: false, color: '#1a73e8' },
  { hue: 'red', light: false, color: '#d93025' },
  { hue: 'yellow', light: false, color: '#f9ab00' },
  { hue: 'green', light: false, color: '#1e8e3e' },
  { hue: 'orange', light: false, color: '#e8710a' },
  { hue: 'pink', light: false, color: '#e52592' },
  { hue: 'purple', light: false, color: '#9334e6' },
  { hue: 'cyan', light: false, color: '#12b5cb' },
  { hue: 'blue', light: true, color: '#8ab4f8' },
  { hue: 'red', light: true, color: '#f28b82' },
  { hue: 'yellow', light: true, color: '#fdd663' },
  { hue: 'green', light: true, color: '#81c995' },
  { hue: 'orange', light: true, color: '#fcad70' },
  { hue: 'pink', light: true, color: '#ff8bcb' },
  { hue: 'purple', light: true, color: '#c58af9' },
  { hue: 'cyan', light: true, color: '#78d9ec' },
]

const swatch = (hue) => ASSET_SWATCHES.find((s) => s.hue === hue && !s.light).color

/** Couleur par défaut des types habituels. */
const ASSET_DEFAULTS = {
  'public equity': swatch('blue'),
  'real estate': swatch('orange'),
  fiat: swatch('green'),
  crypto: swatch('yellow'),
  commodity: swatch('cyan'),
  'managed futures': swatch('purple'),
  exotic: swatch('pink'),
  depreciating: swatch('red'),
}

const keyOf = (name) => String(name ?? '').trim().toLowerCase()
const SWATCH_COLORS = new Set(ASSET_SWATCHES.map((s) => s.color))

/** Garde seulement les couleurs proposées : { type en minuscules: couleur }. */
function validChoices(value) {
  return Object.fromEntries(
    Object.entries(value && typeof value === 'object' ? value : {})
      .map(([name, color]) => [keyOf(name), String(color).toLowerCase()])
      .filter(([name, color]) => name && SWATCH_COLORS.has(color)),
  )
}

/**
 * Couleurs choisies dans le menu de Charts : { 'crypto': '#f9ab00', … } (clé = type en minuscules).
 * Gardées en base, sur le profil (GET /api/profile/, PUT /api/profile/asset-colors/) : celui du compte connecté,
 * sinon celui du site. Chargées au démarrage et à chaque connexion ou déconnexion (lib/profile.js).
 * Réactif : les graphiques se recalculent quand une couleur change.
 */
export const assetColorChoices = ref({})

/** Dernière erreur d'enregistrement ou de chargement des couleurs (message déjà traduit), sinon ''. */
export const assetColorError = ref('')

// Numéro du dernier changement : un enregistrement refusé ne revient en arrière que s'il est toujours le dernier
let version = 0

/**
 * Couleurs du profil reçu (GET /api/profile/, chargé par lib/profile.js). Les couleurs gardées par le navigateur
 * avant le passage en base sont recopiées sur le profil s'il n'en a pas encore, puis effacées du navigateur.
 */
export async function applyProfileAssetColors(profile) {
  let choices = validChoices(profile?.asset_colors)
  const legacy = readLegacyChoices()
  if (!Object.keys(choices).length && Object.keys(legacy).length) {
    choices = validChoices((await saveProfileAssetColors(legacy)).asset_colors)
  }
  if (Object.keys(legacy).length) writePreference('assetColors', null)
  version++ // un enregistrement encore en cours ne remettra pas les couleurs d'avant
  assetColorChoices.value = choices
  assetColorError.value = ''
}

function readLegacyChoices() {
  try {
    return validChoices(JSON.parse(readPreference('assetColors') ?? '{}'))
  } catch {
    return {}
  }
}

// Enregistrements les uns après les autres : le dernier choix est toujours celui qui reste en base
let saving = Promise.resolve()

function saveChoices(next) {
  const previous = assetColorChoices.value
  const mine = ++version
  assetColorChoices.value = next // affiché tout de suite, annulé si le serveur refuse
  saving = saving.then(async () => {
    try {
      await saveProfileAssetColors(next)
      assetColorError.value = ''
    } catch (error) {
      if (version === mine) assetColorChoices.value = previous // sauf si un autre choix a suivi
      assetColorError.value = error.message
    }
  })
  return saving
}

/**
 * Donne la couleur `color` au type `name`. Si un autre type de `names` l'avait déjà, il prend l'ancienne
 * couleur de `name` : deux types ne se retrouvent jamais avec la même couleur.
 */
export function setAssetColor(name, color, names) {
  if (!SWATCH_COLORS.has(color)) return
  const { colors } = assignAssetColors(names)
  const previous = colors.get(name)?.color
  const next = { ...assetColorChoices.value, [keyOf(name)]: color }
  for (const other of names) {
    if (keyOf(other) !== keyOf(name) && colors.get(other)?.color === color && SWATCH_COLORS.has(previous)) {
      next[keyOf(other)] = previous
    }
  }
  saveChoices(next)
}

/** Revient aux couleurs par défaut. */
export function resetAssetColors() {
  saveChoices({})
}

/**
 * Attribue une couleur à chaque type d'actif présent.
 * Couleur choisie dans le menu, sinon couleur par défaut du type ; un type inconnu prend une teinte restée libre
 * (ni choisie, ni réservée à un type habituel) ; s'il n'en reste plus, il est signalé dans `overflow`
 * (à regrouper en « Autres », gris). `slot` donne l'ordre d'affichage.
 */
export function assignAssetColors(names) {
  const choices = assetColorChoices.value
  const orderOf = new Map(ASSET_ORDER.map((key, index) => [key, index]))
  const colors = new Map()
  const unknown = []
  // Teintes déjà prises : celles des types habituels et celles choisies
  const taken = new Set([...Object.values(ASSET_DEFAULTS), ...Object.values(choices)])

  for (const name of names) {
    const key = keyOf(name)
    const color = choices[key] ?? ASSET_DEFAULTS[key]
    if (color) colors.set(name, { slot: orderOf.get(key) ?? ASSET_ORDER.length, color })
    else unknown.push(name)
  }

  const free = ASSET_SWATCHES.map((s) => s.color).filter((color) => !taken.has(color))
  const overflow = []
  const sorted = [...new Set(unknown)].sort((a, b) => a.localeCompare(b, 'fr'))
  sorted.forEach((name, index) => {
    const color = free.shift()
    if (color === undefined) {
      overflow.push(name)
      colors.set(name, { slot: -1, color: CONTEXT })
    } else {
      colors.set(name, { slot: ASSET_ORDER.length + 1 + index, color })
    }
  })

  // Les types connus mais choisis à la main gardent leur place ; un type inconnu avec une couleur choisie va à la suite
  for (const [name, entry] of colors) {
    if (entry.slot === ASSET_ORDER.length) colors.set(name, { ...entry, slot: ASSET_ORDER.length + 1 + sorted.length })
  }

  return { colors, overflow }
}
