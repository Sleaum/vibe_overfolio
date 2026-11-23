// Montants des graphiques : brut ou net, au choix du bouton Brut / Net en haut du menu de Charts (GraphiquesLayout.vue).
//
// - Brut : tes actifs seulement (« Assets Master Currency »), les dettes ne comptent pas.
// - Net : actifs moins dettes. Chaque dette reste sur sa ligne, donc dans son type d'actif, son enveloppe… :
//   les découpages additionnent chaque groupe, puis écartent les groupes négatifs (aggregate.js, noteDropped).
// - Dettes (graphique « Tes dettes », mode Brut) : les dettes seules, en valeur positive.
//
// Une spécification de graphique suit le bouton en déclarant `amounts: true` (ou `amounts: 'debt'` pour les dettes) :
// buildChart() lui passe alors une copie de la table où les montants sont ceux du mode choisi. Pages concernées :
// Flow, Snapshot, Envelopes. Volatility (prix), Budget et entrées / sorties (flux), Strategy (actions) ne changent pas.
//
// Dans la feuille, une ligne est soit un actif (« Assets Master Currency »), soit une dette (« Liabilities Master
// Currency », négative). Les colonnes de devise (EUR, USD, CHF…) portent les deux : positives pour un actif, négatives
// pour une dette. Les anciens relevés n'ont que ces colonnes : celle de la devise d'affichage (EUR par défaut, menu de
// l'en-tête) sert alors, selon son signe.

import { ref } from 'vue'
import { collectDropped, findColumn, toLabel, toNumber } from './aggregate.js'
import { findCurrencyColumn } from './charts/flowData.js'
import { readPreference, writePreference } from './preferences.js'
import { displayCurrency } from './displayCurrency.js'
import { toIsoDate } from './dates.js'
import { formatDateLong } from './format.js'
import { t } from '../i18n/index.js'

export const AMOUNT_MODES = ['gross', 'net']

const saved = readPreference('amounts')
/** Mode choisi : 'gross' (brut, par défaut) ou 'net'. Réactif : les graphiques se recalculent quand il change. */
export const amountMode = ref(AMOUNT_MODES.includes(saved) ? saved : 'gross')

export function setAmountMode(mode) {
  if (!AMOUNT_MODES.includes(mode)) return
  amountMode.value = mode
  writePreference('amounts', mode)
}

const ASSETS = ['Assets Master Currency']
const LIABILITIES = ['Liabilities Master Currency']
const CURRENCIES = ['EUR', 'USD', 'CHF', 'THB']
const LABELS = ['Asset', 'Instrument', 'Envelope']

const blank = (value) => value === null || value === undefined || String(value).trim() === ''

/**
 * Actif et dette d'une ligne : { assets (≥ 0), debts (≤ 0) }.
 * Sans aucune des deux colonnes remplies (anciens relevés), la colonne de la devise d'affichage décide :
 * positive = actif, négative = dette.
 * Une ligne sans libellé (un objectif : seulement une date et un montant) n'est ni l'un ni l'autre.
 */
function rowParts(row, cols) {
  const assets = cols.assets ? toNumber(row[cols.assets]) : 0
  const debts = cols.liabilities ? toNumber(row[cols.liabilities]) : 0
  const empty = (!cols.assets || blank(row[cols.assets])) && (!cols.liabilities || blank(row[cols.liabilities]))
  if (empty && cols.legacy && cols.labels.some((column) => toLabel(row[column], ''))) {
    const value = toNumber(row[cols.legacy])
    return { assets: Math.max(value, 0), debts: Math.min(value, 0) }
  }
  return { assets: Math.max(assets, 0), debts: Math.min(debts, 0) }
}

function columnsOf(table) {
  const columns = table?.columns ?? []
  return {
    assets: findColumn(columns, ASSETS),
    liabilities: findColumn(columns, LIABILITIES),
    legacy: findCurrencyColumn(columns, displayCurrency.value), // anciens relevés (le serveur ajoute cette colonne)
    currencies: [
      ...new Set(
        [...CURRENCIES, ...(table?.currencies_available ?? [])].map((code) => findCurrencyColumn(columns, code)).filter(Boolean),
      ),
    ],
    labels: LABELS.map((name) => findColumn(columns, [name])).filter(Boolean),
  }
}

/**
 * Copie de la table dont les montants sont ceux de `mode` :
 * - « Assets Master Currency » : actifs ('gross'), actifs + dettes ('net') ou dettes en positif ('debt') ;
 * - colonnes de devise : même règle, d'après le signe de chaque montant.
 */
export function amountTable(table, mode) {
  if (!table || !Array.isArray(table.rows)) return table
  const cols = columnsOf(table)
  if (!cols.assets) return table // pas de colonne d'actifs : le graphique dira lui-même ce qui manque
  const pick = (assets, debts) => (mode === 'net' ? assets + debts : mode === 'debt' ? -debts : assets)
  const currency = (value) => (mode === 'net' ? value : mode === 'debt' ? Math.max(-value, 0) : Math.max(value, 0))
  const rows = table.rows.map((row) => {
    const { assets, debts } = rowParts(row, cols)
    const next = { ...row, [cols.assets]: pick(assets, debts) }
    if (cols.liabilities) next[cols.liabilities] = mode === 'net' ? 0 : debts
    for (const column of cols.currencies) if (!blank(row[column])) next[column] = currency(toNumber(row[column]))
    return next
  })
  return { ...table, rows }
}

/** Totaux de la table : { assets (≥ 0), debts (≤ 0) }, pour les repères de la page Snapshot. */
export function amountTotals(table) {
  const cols = columnsOf(table)
  let assets = 0
  let debts = 0
  for (const row of table?.rows ?? []) {
    const parts = rowParts(row, cols)
    assets += parts.assets
    debts += parts.debts
  }
  return { assets, debts }
}

/** Mode d'une spécification : null (ne suit pas le bouton), 'debt', sinon le mode choisi. */
export function modeOf(spec) {
  if (!spec?.amounts) return null
  return spec.amounts === 'debt' ? 'debt' : amountMode.value
}

/** Phrase sur les montants affichés, pour la note sous un graphique ou une page. */
export function amountNote(mode) {
  return mode ? t(`amounts.note.${mode}`) : ''
}

/** Phrase sur les groupes écartés parce que négatifs en net (vide s'il n'y en a pas). */
export function droppedNote(names) {
  return names.length ? t('amounts.dropped', { names: names.join(', ') }, names.length) : ''
}

/**
 * Construit un graphique avec les montants du mode choisi (si la spécification suit le bouton) et ajoute à sa note
 * la nature des montants et les groupes écartés. Utilisé par ChartView (page d'un graphique) et ChartCard (pages groupées).
 */
export function buildChart(spec, table, values = {}) {
  const mode = modeOf(spec)
  const [model, dropped] = collectDropped(() => spec.build(mode ? amountTable(table, mode) : table, values))
  if (!model || model.problem || model.empty) return model
  const notes = mode ? [amountNote(mode), droppedNote(dropped)] : []
  const note = [...notes, projectionNote(table), conversionNote(table), model.note].filter(Boolean).join(' ')
  return note === (model.note ?? '') ? model : { ...model, note }
}

/**
 * Phrase sur le mois prochain ajouté à history par le serveur (positions actuelles de portfolio, graphiques de Flow).
 * Vide s'il n'y en a pas, ou si ses lignes ne sont plus dans la table (filtre d'une année sur la page Flow).
 */
export function projectionNote(table) {
  const projection = table?.projection
  if (!projection?.rows) return ''
  const date = findColumn(table.columns ?? [], ['Date'])
  if (!date || !(table.rows ?? []).some((row) => toIsoDate(row[date]) === projection.date)) return ''
  return t('projection.note', { date: formatDateLong(projection.date), positions: formatDateLong(projection.source_date) })
}

/**
 * Phrase sur la conversion des montants par le serveur (devise d'affichage de l'en-tête, ou feuille dans une autre
 * devise que l'euro), et sur les lignes écartées faute de taux. Vide si les montants sont ceux de la feuille.
 */
export function conversionNote(table) {
  const from = table?.currency
  const to = table?.display_currency
  if (!from || !to || from === to) return ''
  const missing = table.unconverted_rows || 0
  return [
    t('displayCurrency.convertedNote', { from, to }),
    missing ? t('displayCurrency.unconvertedNote', { count: missing, to }, missing) : '',
  ]
    .filter(Boolean)
    .join(' ')
}
