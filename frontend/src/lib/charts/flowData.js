// Calculs communs aux graphiques « Portfolio Flow » : table `_history`, des relevés datés (plusieurs lignes par date).
// Fonctions pures. Un mois est représenté par son dernier relevé, jamais par la somme de ses relevés.

import { findColumn, rowsOf, toLabel, toNumber } from '../aggregate.js'
import { monthKey, toIsoDate } from '../dates.js'
import { capitalize, formatDateLong, percent } from '../format.js'
import { CONTEXT, assignAssetColors } from '../palette.js'

const monthIndex = (key) => {
  const [y, m] = key.split('-').map(Number)
  return y * 12 + m
}

/**
 * Dernier relevé de chaque mois : [{ key: '2026-11', iso: '2026-11-14' }], du plus ancien au plus récent.
 * Une feuille contient parfois des dates isolées (un objectif en 2039, un vieux relevé de 2022) qui étireraient
 * un graphique mensuel : seul le plus long enchaînement de mois est gardé (une pause de plus de `maxGap` mois
 * le coupe). `skipped` donne le nombre de mois laissés de côté.
 */
export function monthEnds(rows, dateColumn, maxGap = 6) {
  const latest = new Map()
  for (const row of rows) {
    const iso = toIsoDate(row[dateColumn])
    if (!iso) continue
    const key = monthKey(iso)
    if (!latest.has(key) || iso > latest.get(key)) latest.set(key, iso)
  }
  const all = [...latest.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([key, iso]) => ({ key, iso }))

  const runs = []
  for (const month of all) {
    const run = runs[runs.length - 1]
    if (run && monthIndex(month.key) - monthIndex(run[run.length - 1].key) <= maxGap) run.push(month)
    else runs.push([month])
  }
  // Le plus long enchaînement ; à égalité, le plus récent
  const main = runs.reduce((best, run) => (run.length >= best.length ? run : best), [])
  return Object.assign(main, { skipped: all.length - main.length })
}

/** Somme d'une colonne de montants pour chaque date : Map "AAAA-MM-JJ" -> nombre. */
export function totalsByDate(rows, dateColumn, valueColumn) {
  const totals = new Map()
  for (const row of rows) {
    const iso = toIsoDate(row[dateColumn])
    if (!iso) continue
    totals.set(iso, (totals.get(iso) ?? 0) + toNumber(row[valueColumn]))
  }
  return totals
}

/**
 * Montants > 0 par date puis par libellé : { days: Map(iso -> Map(nom -> montant)), names: [noms] }.
 * Deux écritures qui ne diffèrent que par la casse sont un seul libellé.
 */
export function groupsByDate(rows, dateColumn, groupColumn, valueColumn, emptyLabel = 'Non renseigné') {
  const days = new Map()
  const names = new Map() // clé en minuscules -> premier libellé rencontré
  for (const row of rows) {
    const iso = toIsoDate(row[dateColumn])
    const value = toNumber(row[valueColumn])
    if (!iso || !(value > 0)) continue
    const label = toLabel(row[groupColumn], emptyLabel)
    const key = label.toLowerCase()
    if (!names.has(key)) names.set(key, label)
    const day = days.get(iso) ?? new Map()
    const name = names.get(key)
    day.set(name, (day.get(name) ?? 0) + value)
    days.set(iso, day)
  }
  return { days, names: [...names.values()] }
}

/**
 * Colonne de montants d'une devise (« Assets CHF », « USD »…). Préfère les colonnes d'actifs et écarte
 * les colonnes de prix, de quantités ou de dettes, qui ne sont pas des totaux de patrimoine.
 */
export function findCurrencyColumn(columns, code) {
  const token = new RegExp(`(^|[^a-z])${code}([^a-z]|$)`, 'i')
  const score = (column) => {
    const name = String(column)
    if (/price|prix|quantit|unit|liabilit|dette|passif/i.test(name)) return -1
    return /asset|actif/i.test(name) ? 2 : 1
  }
  const candidates = (columns ?? []).filter((column) => token.test(String(column)) && score(column) > 0)
  return candidates.sort((a, b) => score(b) - score(a))[0] ?? null
}

/** Droite des moindres carrés sur [[x, y], …] : y = slope * x + intercept. */
export function linearTrend(points) {
  const n = points.length
  const meanX = points.reduce((sum, [x]) => sum + x, 0) / n
  const meanY = points.reduce((sum, [, y]) => sum + y, 0) / n
  let covariance = 0
  let variance = 0
  for (const [x, y] of points) {
    covariance += (x - meanX) * (y - meanY)
    variance += (x - meanX) ** 2
  }
  const slope = variance ? covariance / variance : 0
  return { slope, intercept: meanY - slope * meanX }
}

const currencyFormats = new Map()

/** 12345 -> "12 345 CHF" / "12 345 $US" selon la devise ; devise inconnue : le code après le nombre. */
export function money(value, code) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '–'
  let format = currencyFormats.get(code)
  if (!format) {
    try {
      format = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: code, maximumFractionDigits: 0 })
    } catch {
      format = null
    }
    currencyFormats.set(code, format)
  }
  const rounded = Math.abs(n) < 0.5 ? 0 : n
  return format ? format.format(rounded) : `${Math.round(rounded)} ${code}`
}

const compact = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 })

/** Étiquette d'axe sans symbole monétaire : 150000 -> "150 k". */
export const compactNumber = (value) => (Number.isFinite(Number(value)) ? compact.format(Number(value)) : '')

/** 3.2 -> "+3,2 %" ; -1.5 -> "-1,5 %" (le signe est toujours écrit). */
export function signedPercent(points) {
  const text = percent(Math.abs(points) / 100)
  if (points > 0) return `+${text}`
  return points < 0 ? `-${text}` : text
}

/**
 * Montants par type d'actif pour chaque mois (dernier relevé du mois), prêts pour un graphique.
 * `series` suit l'ordre fixe des couleurs ; au-delà de 8 types, les derniers sont regroupés en « Autres ».
 * `values[s][m]` : montant du type `s` au mois `m`. Les mois sans aucun montant positif sont écartés.
 */
export function assetMonthly(rows, dateColumn, assetColumn, valueColumn) {
  const { days, names } = groupsByDate(rows, dateColumn, assetColumn, valueColumn)
  const { colors, overflow } = assignAssetColors(names)
  const folded = new Set(overflow)

  const series = names
    .filter((name) => !folded.has(name))
    .map((name) => ({
      label: capitalize(name),
      color: colors.get(name).color,
      slot: colors.get(name).slot,
      members: [name],
    }))
    .sort((a, b) => a.slot - b.slot)
  if (overflow.length) series.push({ label: 'Autres', color: CONTEXT, slot: 99, members: overflow })

  const allMonths = monthEnds(rows, dateColumn)
  const amount = (serie, month) =>
    serie.members.reduce((sum, name) => sum + (days.get(month.iso)?.get(name) ?? 0), 0)
  const months = allMonths.filter((month) => series.some((serie) => amount(serie, month) > 0))

  const values = series.map((serie) => months.map((month) => amount(serie, month)))
  const totals = months.map((_, m) => values.reduce((sum, row) => sum + row[m], 0))
  return { months, series, values, totals, skipped: allMonths.skipped }
}

/** Phrase à afficher sous un graphique quand des mois isolés ont été écartés (sinon chaîne vide). */
export function skippedNote(count) {
  if (!count) return ''
  return (
    `${count > 1 ? `${count} mois très éloignés des autres relevés ne sont pas affichés` : '1 mois très éloigné des autres relevés n’est pas affiché'}` +
    ' (une pause de plus de 6 mois coupe la série).'
  )
}

/** Sous-titre des graphiques mensuels : date du dernier relevé affiché. */
export function monthsSubtitle(months) {
  const last = months[months.length - 1]
  return last ? `Relevés jusqu’au ${formatDateLong(last.iso)}.` : ''
}

const DATE_NAMES = ['Date', 'Mois', 'Month']

/** Années des relevés mensuels d'une table (enchaînement principal, sans les dates isolées), de la plus récente à la plus ancienne. */
export function yearsOf(table) {
  const dateColumn = findColumn(table?.columns, DATE_NAMES)
  if (!dateColumn) return []
  return [...new Set(monthEnds(rowsOf(table), dateColumn).map((month) => month.key.slice(0, 4)))].sort().reverse()
}

/** Copie de la table réduite aux lignes d'une année ("2026") ; `year` vide ou table sans colonne de date : table inchangée. */
export function filterByYear(table, year) {
  if (!table || !year) return table
  const dateColumn = findColumn(table.columns, DATE_NAMES)
  if (!dateColumn) return table
  return { ...table, rows: rowsOf(table).filter((row) => (toIsoDate(row[dateColumn]) ?? '').startsWith(`${year}-`)) }
}
