import { CHART_COLORS, COLORS } from './theme.js'

// Palette des graphiques : identique sur tout le site, dans un ordre fixe (jamais permuté, jamais cyclique).
// Les 8 teintes passent le contrôle daltonisme du skill dataviz (écart ΔE ≥ 8 entre voisines, fond blanc).
// Trois teintes (turquoise, jaune, rose) sont plus claires que 3:1 sur blanc : chaque graphique a donc
// une légende, une infobulle et une vue « tableau » qui portent la même information.

export const SERIES = [
  '#2a78d6', // 1 bleu
  '#eb6834', // 2 orange
  '#1baf7a', // 3 turquoise
  '#eda100', // 4 jaune
  '#e87ba4', // 5 rose
  '#008300', // 6 vert
  '#6250d6', // 7 violet
  '#e34948', // 8 rouge
]

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
// L'ordre est celui des pastilles ci-dessus ; un type absent laisse simplement sa couleur libre.
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

const keyOf = (name) => String(name ?? '').trim().toLowerCase()

/**
 * Attribue une couleur à chaque type d'actif présent.
 * Les types connus gardent leur couleur ; un type inconnu prend une couleur restée libre ;
 * s'il n'en reste plus, il est signalé dans `overflow` (à regrouper en « Autres », gris).
 */
export function assignAssetColors(names) {
  const slotByKey = new Map(ASSET_ORDER.map((key, index) => [key, index]))
  const used = new Set()
  const colors = new Map()
  const unknown = []

  for (const name of names) {
    const slot = slotByKey.get(keyOf(name))
    if (slot === undefined) {
      unknown.push(name)
    } else {
      colors.set(name, { slot, color: SERIES[slot] })
      used.add(slot)
    }
  }

  const free = SERIES.map((_, index) => index).filter((index) => !used.has(index))
  const overflow = []
  for (const name of [...unknown].sort((a, b) => a.localeCompare(b, 'fr'))) {
    const slot = free.shift()
    if (slot === undefined) {
      overflow.push(name)
      colors.set(name, { slot: -1, color: CONTEXT })
    } else {
      colors.set(name, { slot, color: SERIES[slot] })
    }
  }

  return { colors, overflow }
}
