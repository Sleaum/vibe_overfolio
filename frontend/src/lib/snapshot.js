// Page « Portfolio Snapshot » : un instantané du patrimoine, calculé à partir de la table `portfolio`
// (positions actuelles) et, pour les variations de l'année et du mois, de la table `_history`.
// Fonctions pures : testables sans navigateur. Seules Asset et Assets Master Currency sont obligatoires ;
// les autres découpages (sous-type, instrument, enveloppe, courtier, zone) n'apparaissent que si la colonne existe.

import { findColumn, latestDate, requireColumns, rowsOf, splitBy, toLabel, toNumber } from './aggregate.js'
import { assetParts } from './charts/assetDonut.js'
import { totalsByDate } from './charts/flowData.js'
import { capitalize, euro, percent } from './format.js'
import { ASSET_ORDER, CONTEXT, assignAssetColors } from './palette.js'

/** Découpages proposés pour chaque type d'actif, avec les noms de colonnes acceptés (le premier est celui affiché en cas d'erreur). */
export const DIMENSIONS = [
  { key: 'sub', label: 'Sous-type', names: ['Sub Asset', 'Sub-Asset', 'SubAsset', 'Sous-type', 'Sous type'] },
  { key: 'instrument', label: 'Instrument', names: ['Instrument'] },
  { key: 'envelope', label: 'Enveloppe', names: ['Envelope', 'Enveloppe', 'Account', 'Compte', 'Wrapper'] },
  { key: 'broker', label: 'Courtier', names: ['Broker', 'Courtier'] },
  { key: 'area', label: 'Zone', names: ['Area', 'Zone', 'Region', 'Région'] },
]

const MAX_ITEMS = 6 // au-delà, le reste est regroupé en « Autres »

const twoDigits = new Intl.NumberFormat('fr-FR', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** 0.1489 -> "+14,89 %" ; le signe est toujours écrit pour ne pas dépendre de la couleur. */
export function signedPercent2(fraction) {
  const text = twoDigits.format(Math.abs(fraction))
  if (fraction > 0) return `+${text}`
  return fraction < 0 ? `-${text}` : text
}

/**
 * Variation du patrimoine depuis le début de l'année et du mois, d'après `_history` (total des actifs par date).
 * Référence : le dernier relevé avant le 1er du mois / de l'année, sinon le premier relevé de la période.
 * La variation inclut les versements et retraits : ce n'est pas un rendement de placement.
 * Renvoie { year, month } ; chaque valeur est { fraction, since } ou null si on ne peut pas la calculer.
 */
export function periodChanges(history, asOfIso) {
  const none = { year: null, month: null }
  try {
    const cols = requireColumns(history, { date: ['Date'], value: ['Assets Master Currency'] })
    const totals = totalsByDate(rowsOf(history), cols.date, cols.value)
    const dates = [...totals.keys()].filter((iso) => iso <= asOfIso).sort()
    if (dates.length < 2) return none

    const current = dates[dates.length - 1]
    const currentTotal = totals.get(current)

    const change = (periodStart) => {
      const before = dates.filter((iso) => iso < periodStart)
      const reference = before.length ? before[before.length - 1] : dates.find((iso) => iso >= periodStart)
      if (!reference || reference === current) return null
      const base = totals.get(reference)
      if (!(base > 0)) return null
      return { fraction: (currentTotal - base) / base, since: reference }
    }

    return { year: change(`${current.slice(0, 4)}-01-01`), month: change(`${current.slice(0, 7)}-01`) }
  } catch {
    return none // pas d'historique exploitable : les deux variations restent « – », la page s'affiche quand même
  }
}

/** Montants d'un découpage : les 6 plus gros, le reste en « Autres », avec la part de chacun dans `total`. */
function topItems(rows, column, valueColumn, total) {
  const { entries } = splitBy(rows, column, valueColumn)
  const shown = entries.slice(0, MAX_ITEMS)
  const rest = entries.slice(MAX_ITEMS)
  const items = shown.map((entry) => ({ name: entry.name, value: entry.value, share: entry.value / total }))
  if (rest.length) {
    const value = rest.reduce((sum, entry) => sum + entry.value, 0)
    items.push({ name: `Autres (${rest.length})`, value, share: value / total })
  }
  return items
}

/**
 * Construit tout ce qu'affiche la page.
 * @param portfolio table `portfolio` de l'API
 * @param history   table `_history` (ou null) : sert seulement aux variations de l'année et du mois
 * @param today     "AAAA-MM-JJ" : date de référence si la table n'a pas de colonne Date
 */
export function buildSnapshot(portfolio, history = null, today = new Date().toISOString().slice(0, 10)) {
  const cols = requireColumns(portfolio, { asset: ['Asset'], value: ['Assets Master Currency'] })
  const rows = rowsOf(portfolio)

  const { entries, total: gross } = splitBy(rows, cols.asset, cols.value)
  if (!entries.length) return { empty: 'Aucun montant supérieur à 0 dans la table portfolio.' }

  // Dettes : colonne facultative, montants négatifs (patrimoine net = actifs + dettes)
  const liabilitiesColumn = findColumn(portfolio.columns, ['Liabilities Master Currency'])
  const liabilities = liabilitiesColumn
    ? rows.reduce((sum, row) => sum + toNumber(row[liabilitiesColumn]), 0)
    : 0
  const net = gross + liabilities

  const dateColumn = findColumn(portfolio.columns, ['Date'])
  const asOf = (dateColumn && latestDate(rows, dateColumn)) || today

  // Anneau des types d'actifs (mêmes couleurs que partout sur le site)
  const parts = assetParts(entries, gross)
  const byValue = [...parts].sort((a, b) => b.value - a.value)

  // Un bloc par type d'actif, dans l'ordre fixe des couleurs ; les types hors liste à la suite
  const dimensions = DIMENSIONS.map((dim) => ({ ...dim, column: findColumn(portfolio.columns, dim.names) })).filter(
    (dim) => dim.column,
  )
  const { colors } = assignAssetColors(entries.map((entry) => entry.name))
  const rank = (name) => {
    const slot = colors.get(name)?.slot ?? -1
    return slot >= 0 ? slot : 99
  }
  const types = [...entries]
    .sort((a, b) => rank(a.name) - rank(b.name) || b.value - a.value)
    .map((entry) => {
      const mine = rows.filter((row) => toLabel(row[cols.asset]).toLowerCase() === entry.name.toLowerCase())
      return {
        name: capitalize(entry.name),
        color: colors.get(entry.name)?.color ?? CONTEXT,
        value: entry.value,
        share: entry.value / gross,
        dimensions: dimensions
          .map((dim) => ({ key: dim.key, label: dim.label, items: topItems(mine, dim.column, cols.value, entry.value) }))
          .filter((dim) => dim.items.length),
      }
    })

  // Types habituels sans aucune ligne (le type « depreciating » n'est pas listé quand il est absent)
  const present = new Set(entries.map((entry) => entry.name.toLowerCase()))
  const missing = ASSET_ORDER.filter((name) => name !== 'depreciating' && !present.has(name)).map(capitalize)

  return {
    asOf,
    gross,
    net,
    liabilities,
    hasLiabilities: Boolean(liabilitiesColumn),
    parts,
    legend: byValue.map((part) => ({
      name: part.name,
      color: part.color,
      amount: euro(part.value),
      share: percent(part.share),
    })),
    changes: history ? periodChanges(history, asOf) : { year: null, month: null },
    types,
    missing,
    usedColumns: dimensions.map((dim) => `${dim.label} : ${dim.column}`),
    missingDimensions: DIMENSIONS.filter((dim) => !dimensions.some((d) => d.key === dim.key)).map((dim) => dim.label),
  }
}
