// Page « Volatilité » (/volatilite) : comment le prix de chaque placement a bougé sur 1 mois, 3 mois et 1 an,
// comme la page « Portfolio Volatility » de l'ancien rapport Data Studio (une bulle par ligne : montant détenu et variation).
//
// Calcul, à partir de la table `_history` seulement (aucun onglet de plus à synchroniser) :
// - prix unitaire en euros d'une ligne = Assets Master Currency / Quantity, au dernier relevé et au relevé d'il y a N mois ;
//   il intègre donc le change (un titre en dollars bouge aussi avec l'euro/dollar) mais pas tes achats ni tes ventes ;
// - une ligne = même Instrument, même enveloppe et même courtier aux deux dates ;
// - les liquidités, l'immobilier, les biens qui se déprécient et les objets (fiat, real estate, depreciating, exotic)
//   n'ont pas de cours : ils sont écartés.

import { DataError, findColumn, requireColumns, rowsOf, toLabel, toNumber } from '../aggregate.js'
import { axisLabelStyle, baseOption, tooltipBox, tooltipHtml } from '../chartTheme.js'
import { toIsoDate } from '../dates.js'
import { axisPercent, capitalize, euro, formatDateLong } from '../format.js'
import { envelopeLabel } from './envelopes.js'
import { AXIS, GRID, INK_2, SURFACE, assignAssetColors } from '../palette.js'
import { compactNumber, monthEnds, signedPercent } from './flowData.js'
import { t } from '../../i18n/index.js'

const NOT_QUOTED = new Set(['fiat', 'real estate', 'depreciating', 'exotic', 'cash', 'liquidités'])
const DAY = 86_400_000

const lower = (text) => String(text ?? '').trim().toLowerCase()

/** "AAAA-MM-JJ" décalée de `months` mois en arrière. */
function monthsBefore(iso, months) {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1 - months, d))
  return date.toISOString().slice(0, 10)
}

/**
 * Variation du prix unitaire de chaque ligne entre le dernier relevé et celui d'il y a `months` mois
 * (le plus récent relevé daté au plus tard 7 jours après cette date-là).
 * Retourne { latest, reference, lines: [{ name, envelope, asset, amount, before, after, pct }] } ; reference = '' si
 * l'historique est trop court.
 */
export function priceChanges(table, months) {
  const cols = requireColumns(table, {
    date: ['Date'],
    instrument: ['Instrument', 'Instruments'],
    quantity: ['Quantity', 'Quantité', 'Quantite', 'Qty'],
    value: ['Assets Master Currency'],
  })
  const asset = findColumn(table.columns, ['Asset'])
  const envelope = findColumn(table.columns, ['Envelope', 'Enveloppe', 'Account', 'Compte'])
  const broker = findColumn(table.columns, ['Broker', 'Courtier'])
  const rows = rowsOf(table)

  const ends = monthEnds(rows, cols.date)
  if (!ends.length) return { latest: '', reference: '', lines: [] }
  const latest = ends[ends.length - 1].iso
  const first = ends[0].iso
  const limit = new Date(Date.parse(monthsBefore(latest, months)) + 7 * DAY).toISOString().slice(0, 10)
  const dates = [...new Set(rows.map((row) => toIsoDate(row[cols.date])).filter((iso) => iso && iso >= first && iso <= limit))]
  const reference = dates.sort().pop() ?? ''
  if (!reference) return { latest, reference: '', lines: [] }

  const keyOf = (row) =>
    [row[cols.instrument], envelope ? row[envelope] : '', broker ? row[broker] : ''].map(lower).join('|')
  const unitPrice = (row) => {
    const quantity = toNumber(row[cols.quantity])
    const value = toNumber(row[cols.value])
    return quantity > 0 && value > 0 ? value / quantity : null
  }

  const before = new Map()
  const after = new Map()
  for (const row of rows) {
    const iso = toIsoDate(row[cols.date])
    if (iso !== latest && iso !== reference) continue
    if (!toLabel(row[cols.instrument], '')) continue
    if (asset && NOT_QUOTED.has(lower(row[asset]))) continue
    const price = unitPrice(row)
    if (price === null) continue
    const target = iso === latest ? after : before
    const key = keyOf(row)
    const current = target.get(key)
    // Deux lignes identiques le même jour (achats successifs) : on additionne montants et quantités
    target.set(key, {
      row,
      amount: (current?.amount ?? 0) + toNumber(row[cols.value]),
      quantity: (current?.quantity ?? 0) + toNumber(row[cols.quantity]),
    })
  }

  const lines = []
  for (const [key, now] of after) {
    const then = before.get(key)
    if (!then) continue
    const priceAfter = now.amount / now.quantity
    const priceBefore = then.amount / then.quantity
    lines.push({
      name: envelopeLabel(toLabel(now.row[cols.instrument])),
      envelope: envelope ? toLabel(now.row[envelope], '') : '',
      asset: asset ? toLabel(now.row[asset]) : t('data.unknown'),
      amount: now.amount,
      before: priceBefore,
      after: priceAfter,
      pct: (priceAfter / priceBefore - 1) * 100,
    })
  }
  lines.sort((a, b) => a.pct - b.pct)
  return { latest, reference, lines }
}

export function bubbleOption(lines) {
  const { colors } = assignAssetColors([...new Set(lines.map((line) => line.asset))])
  const maxAmount = Math.max(...lines.map((line) => line.amount))
  const size = (amount) => 8 + 40 * Math.sqrt(amount / maxAmount)
  const assets = [...new Set(lines.map((line) => line.asset))].sort(
    (a, b) => (colors.get(a)?.slot ?? 99) - (colors.get(b)?.slot ?? 99),
  )

  return {
    ...baseOption(),
    grid: { left: 8, right: 24, top: 44, bottom: 36, containLabel: true },
    legend: {
      data: assets.map(capitalize),
      top: 0,
      left: 0,
      icon: 'circle',
      itemWidth: 10,
      itemHeight: 10,
      itemGap: 18,
      textStyle: { color: INK_2, fontSize: 13 },
    },
    tooltip: tooltipBox({
      trigger: 'item',
      formatter: (p) => {
        const line = p?.data?.line
        if (!line) return ''
        return tooltipHtml(line.envelope ? `${line.name} (${envelopeLabel(line.envelope)})` : line.name, [
          { color: colors.get(line.asset)?.color, label: t('charts.volatility.priceChange'), value: signedPercent(line.pct), strong: true },
          { label: t('charts.volatility.held'), value: euro(line.amount) },
          { label: t('charts.volatility.priceBefore'), value: euro(line.before) },
          { label: t('charts.volatility.priceNow'), value: euro(line.after) },
        ])
      },
    }),
    xAxis: {
      type: 'log',
      name: t('charts.volatility.heldLog'),
      nameLocation: 'middle',
      nameGap: 26,
      nameTextStyle: { color: INK_2, fontSize: 12 },
      axisLine: { lineStyle: { color: AXIS } },
      splitLine: { lineStyle: { color: GRID } },
      axisLabel: { ...axisLabelStyle, formatter: (value) => compactNumber(value) },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      splitLine: { lineStyle: { color: GRID } },
      axisLabel: { ...axisLabelStyle, formatter: axisPercent },
    },
    series: assets.map((name) => ({
      name: capitalize(name),
      type: 'scatter',
      itemStyle: { color: colors.get(name)?.color, opacity: 0.85, borderColor: SURFACE, borderWidth: 1 },
      emphasis: { focus: 'series' },
      data: lines
        .filter((line) => line.asset === name)
        .map((line) => ({ value: [Math.max(line.amount, 1), Number(line.pct.toFixed(2))], symbolSize: size(line.amount), line })),
      markLine:
        name === assets[0]
          ? { silent: true, symbol: 'none', label: { show: false }, lineStyle: { color: INK_2, type: 'solid', width: 1 }, data: [{ yAxis: 0 }] }
          : undefined,
    })),
  }
}

function volatilitySpec({ months, slug }) {
  const period = () => t(`charts.volatility.period.${months}`)
  return {
    slug,
    get title() {
      return t(`charts.volatility.title.${months}`)
    },
    get summary() {
      return t('charts.volatility.summary', { period: period() })
    },
    table: '_history',
    minWidth: 640,
    get explain() {
      return [
        t('charts.volatility.explain1', { period: period() }),
        t('charts.volatility.explain2'),
        t('charts.volatility.explain3'),
      ]
    },
    get source() {
      return t('charts.volatility.source', { period: period() })
    },

    build(table) {
      const { latest, reference, lines } = priceChanges(table, months)
      if (!latest) return { empty: t('charts.envelopes.noRecord') }
      if (!reference) return { empty: t('charts.volatility.notYet', { period: period(), date: formatDateLong(latest) }) }
      if (!lines.length) {
        throw new DataError(
          t('charts.volatility.noCommon', { from: formatDateLong(reference), to: formatDateLong(latest) }),
        )
      }

      const total = lines.reduce((sum, line) => sum + line.amount, 0)
      const weighted = lines.reduce((sum, line) => sum + line.pct * line.amount, 0) / total
      const worst = lines[0]
      const best = lines[lines.length - 1]
      return {
        subtitle: t('charts.volatility.range', { from: formatDateLong(reference), to: formatDateLong(latest) }),
        summary: t('charts.volatility.a11y', {
          investments: t('charts.volatility.count', { count: lines.length }, lines.length),
          from: formatDateLong(reference),
          to: formatDateLong(latest),
          weighted: signedPercent(weighted),
          worst: worst.name,
          worstPct: signedPercent(worst.pct),
          best: best.name,
          bestPct: signedPercent(best.pct),
        }),
        option: bubbleOption(lines),
        height: 440,
        table: {
          columns: [
            t('charts.volatility.investment'),
            t('charts.envelopes.envelope'),
            t('charts.volatility.type'),
            t('chart.amount'),
            t('charts.volatility.priceChange'),
          ],
          numeric: [false, false, false, true, true],
          rows: lines.map((line) => [line.name, line.envelope ? envelopeLabel(line.envelope) : '', capitalize(line.asset), euro(line.amount), signedPercent(line.pct)]),
        },
        note: t('charts.volatility.note', { weighted: signedPercent(weighted), total: euro(total) }),
      }
    },
  }
}

export const VOLATILITY_CHARTS = [
  volatilitySpec({ months: 1, slug: 'volatilite-1-mois' }),
  volatilitySpec({ months: 3, slug: 'volatilite-3-mois' }),
  volatilitySpec({ months: 12, slug: 'volatilite-1-an' }),
]
