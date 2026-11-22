// Calculs des graphiques. Fonctions pures : une table de l'API en entrée, des totaux en sortie.
// Règle de la feuille : on ne somme que « Assets Master Currency » et « Liabilities Master Currency ».
// « Equity » mélange les devises et « Currency Price » n'est que la devise de cotation : jamais pour un total.

import { t } from '../i18n/index.js'
import { isoToTimestamp, toIsoDate } from './dates.js'

/** Erreur dont le message est destiné à être lu tel quel dans la page. */
export class DataError extends Error {
  constructor(message) {
    super(message)
    this.name = 'DataError'
  }
}

const normalize = (text) =>
  String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[\s_-]+/g, ' ')
    .trim()
    .toLowerCase()

/** Nombre venu de la feuille : 12.5, "12,5", "1 234,56 €" -> nombre ; le reste -> 0. */
export function toNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value !== 'string') return 0
  let text = value.replace(/[\s  €$£]/g, '')
  if (text.includes(',') && text.includes('.')) text = text.replace(/\./g, '')
  const n = Number(text.replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

/** Texte nettoyé d'une cellule, ou `fallback` si elle est vide. */
export function toLabel(value, fallback = t('data.unknown')) {
  if (value === null || value === undefined) return fallback
  const text = String(value).trim()
  return text || fallback
}

/** Retrouve une colonne sans tenir compte de la casse, des accents et des espaces. */
export function findColumn(columns, candidates) {
  const wanted = candidates.map(normalize)
  return (columns ?? []).find((column) => wanted.includes(normalize(column))) ?? null
}

/**
 * Colonnes obligatoires : { cle: ['Nom attendu', 'autre nom accepté'] } -> { cle: 'nom réel' }.
 * Lève une DataError lisible si l'une manque.
 */
export function requireColumns(table, wanted) {
  const columns = table?.columns ?? []
  const found = {}
  const missing = []
  for (const [key, candidates] of Object.entries(wanted)) {
    const column = findColumn(columns, candidates)
    if (column) found[key] = column
    else missing.push(candidates[0])
  }
  if (missing.length) {
    throw new DataError(
      t('errors.missingColumns', {
        table: table?.name ?? '?',
        missing: missing.join(', '),
        available: columns.join(', ') || t('data.none'),
      }),
    )
  }
  return found
}

export const rowsOf = (table) => (Array.isArray(table?.rows) ? table.rows : [])

/*
 * Groupes négatifs. En montants nets (bouton Brut / Net, lib/amounts.js), une dette est retirée du groupe auquel elle
 * appartient (le prêt de la maison de « real estate »). Les découpages additionnent donc d'abord chaque groupe, puis
 * n'affichent que les groupes positifs : un groupe dont les dettes dépassent les actifs ne peut pas être une part.
 * Ses noms sont relevés ici, pour qu'une note sous le graphique le dise (collectDropped).
 */
let dropped = null

/** Relève le nom d'un groupe écarté parce que son total est négatif. */
export function noteDropped(name) {
  dropped?.add(name)
}

/** Exécute `build()` et renvoie [résultat, noms des groupes négatifs écartés pendant le calcul]. */
export function collectDropped(build) {
  const previous = dropped
  dropped = new Set()
  try {
    const result = build()
    return [result, [...dropped]]
  } finally {
    dropped = previous
  }
}

/** Date la plus récente d'une colonne, "AAAA-MM-JJ", ou "" s'il n'y en a pas. */
export function latestDate(rows, dateColumn) {
  let latest = ''
  for (const row of rows) {
    const iso = toIsoDate(row[dateColumn])
    if (iso && iso > latest) latest = iso
  }
  return latest
}

/**
 * Somme des montants par libellé, du plus gros au plus petit. Chaque libellé est d'abord additionné (dettes comprises
 * en montants nets), puis seuls les totaux positifs sont gardés ; un total négatif est relevé (noteDropped).
 */
export function splitBy(rows, keyColumn, valueColumn, emptyLabel = t('data.unknown')) {
  const groups = new Map()
  for (const row of rows) {
    const value = toNumber(row[valueColumn])
    if (!value) continue
    const name = toLabel(row[keyColumn], emptyLabel)
    const key = name.toLowerCase()
    const group = groups.get(key) ?? { name, value: 0 }
    group.value += value
    groups.set(key, group)
  }
  const entries = [...groups.values()]
    .filter((group) => {
      if (group.value < 0) noteDropped(group.name)
      return group.value > 0
    })
    .sort(
    (a, b) => b.value - a.value || a.name.localeCompare(b.name, 'fr'),
  )
  const total = entries.reduce((sum, entry) => sum + entry.value, 0)
  return { entries, total }
}

/** Courbe : une ligne par date, somme des actifs, somme des dettes, patrimoine net = actifs + dettes. */
export function buildEvolution(rows, dateColumn, assetsColumn, liabilitiesColumn = null) {
  const byDate = new Map()
  for (const row of rows) {
    const iso = toIsoDate(row[dateColumn])
    if (!iso) continue
    const entry = byDate.get(iso) ?? {
      date: iso,
      ts: isoToTimestamp(iso),
      assets: 0,
      liabilities: 0,
    }
    entry.assets += toNumber(row[assetsColumn])
    if (liabilitiesColumn) entry.liabilities += toNumber(row[liabilitiesColumn])
    byDate.set(iso, entry)
  }
  return [...byDate.values()]
    .sort((a, b) => a.ts - b.ts)
    .map((entry) => ({ ...entry, net: entry.assets + entry.liabilities }))
}

/**
 * Flux du budget : liens Source -> Destination sommés, sans boucle (ECharts exige un graphe sans cycle).
 * Quand un lien fermerait une boucle, le plus petit est écarté (`dropped` en donne le nombre).
 */
export function buildFlow(rows, sourceColumn, targetColumn, valueColumn) {
  const sums = new Map()
  for (const row of rows) {
    const source = toLabel(row[sourceColumn], '')
    const target = toLabel(row[targetColumn], '')
    const value = toNumber(row[valueColumn])
    if (!source || !target || source === target || !(value > 0)) continue
    const key = `${source}\u0000${target}`
    const link = sums.get(key) ?? { source, target, value: 0 }
    link.value += value
    sums.set(key, link)
  }

  const inOrder = [...sums.values()]
  const adjacency = new Map()
  const reaches = (from, to) => {
    const seen = new Set()
    const stack = [from]
    while (stack.length) {
      const node = stack.pop()
      if (node === to) return true
      if (seen.has(node)) continue
      seen.add(node)
      for (const next of adjacency.get(node) ?? []) stack.push(next)
    }
    return false
  }

  const kept = new Set()
  for (const link of [...inOrder].sort((a, b) => b.value - a.value)) {
    if (reaches(link.target, link.source)) continue
    kept.add(link)
    adjacency.set(link.source, [...(adjacency.get(link.source) ?? []), link.target])
  }

  const links = inOrder.filter((link) => kept.has(link))
  const nodes = [...new Set(links.flatMap((link) => [link.source, link.target]))]
  return { nodes, links, dropped: inOrder.length - links.length }
}

/**
 * Entrées, sorties et impôts par mois (table `inout`) : [{ key: 'AAAA-MM', inflow, outflow, tax }], du plus ancien au
 * plus récent, sans trou (un mois sans mouvement vaut 0). Les sorties et les impôts sont souvent saisis en négatif dans
 * la feuille : ils sont comptés en valeur absolue. Les entrées gardent leur signe (une correction négative la réduit).
 */
export function buildInOut(rows, { date, inflow, outflow, tax = null }) {
  const months = new Map()
  for (const row of rows) {
    const iso = toIsoDate(row[date])
    if (!iso) continue
    const key = iso.slice(0, 7)
    const month = months.get(key) ?? { key, inflow: 0, outflow: 0, tax: 0 }
    month.inflow += toNumber(row[inflow])
    month.outflow += Math.abs(toNumber(row[outflow]))
    if (tax) month.tax += Math.abs(toNumber(row[tax]))
    months.set(key, month)
  }
  const keys = [...months.keys()].sort()
  if (!keys.length) return []

  const result = []
  let [y, m] = keys[0].split('-').map(Number)
  const last = keys[keys.length - 1]
  for (;;) {
    const key = `${y}-${String(m).padStart(2, '0')}`
    result.push(months.get(key) ?? { key, inflow: 0, outflow: 0, tax: 0 })
    if (key >= last) break
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
  }
  return result
}
