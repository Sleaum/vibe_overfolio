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

// Surfaces et encres des graphiques (mêmes valeurs que tailwind.config.js)
export const SURFACE = '#ffffff'
export const INK = '#1f2328'
export const INK_2 = '#4b5159'
export const GRID = '#e4e6e9'
export const AXIS = '#cfd3d8'

// Mode sombre : chaque couleur claire ci-dessus est remplacée par son équivalent sombre (BaseChart.vue,
// lib/chartTheme.js). Les graphiques sont toujours construits en clair ; seules ces valeurs exactes changent.
// Pour un texte blanc posé sur une couleur de série, écrire '#fff' (et non '#ffffff') : il reste blanc.
export const DARK = {
  [SURFACE]: '#16191d', // fond des cartes (paper sombre)
  [INK]: '#e6e8eb',
  [INK_2]: '#b4bac2',
  [GRID]: '#2b3036',
  [AXIS]: '#3d434b',
  'rgba(31, 35, 40, 0.04)': 'rgba(255, 255, 255, 0.06)', // ombre de survol des barres
  'rgba(31,35,40,0.22)': 'rgba(0,0,0,0.55)', // ombre des infobulles
}

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
