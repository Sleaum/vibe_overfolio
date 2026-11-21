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
import { capitalize, euro, formatDateLong, plural } from '../format.js'
import { envelopeLabel } from './envelopes.js'
import { AXIS, GRID, INK_2, assignAssetColors } from '../palette.js'
import { compactNumber, monthEnds, signedPercent } from './flowData.js'

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
      asset: asset ? toLabel(now.row[asset]) : 'Non renseigné',
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
          { color: colors.get(line.asset)?.color, label: 'Variation du prix', value: signedPercent(line.pct), strong: true },
          { label: 'Montant détenu', value: euro(line.amount) },
          { label: 'Prix unitaire avant', value: euro(line.before) },
          { label: 'Prix unitaire maintenant', value: euro(line.after) },
        ])
      },
    }),
    xAxis: {
      type: 'log',
      name: 'Montant détenu (échelle logarithmique)',
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
      axisLabel: { ...axisLabelStyle, formatter: (value) => `${value} %` },
    },
    series: assets.map((name) => ({
      name: capitalize(name),
      type: 'scatter',
      itemStyle: { color: colors.get(name)?.color, opacity: 0.85, borderColor: '#fff', borderWidth: 1 },
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

function volatilitySpec({ months, slug, title, period }) {
  return {
    slug,
    title,
    summary: `De combien le prix de chacun de tes placements a bougé sur ${period}.`,
    table: '_history',
    minWidth: 640,
    explain: [
      `Une bulle par placement. Horizontalement, le montant que tu détiens (échelle logarithmique : chaque graduation multiplie par 10) ; verticalement, la variation de son prix unitaire sur ${period}. Plus la bulle est grosse, plus le placement pèse dans ton patrimoine.`,
      'Le prix unitaire est calculé en euros (montant ÷ quantité) : il tient compte du change, mais pas de tes achats ni de tes ventes. Une grosse bulle loin sous la ligne du zéro est le placement qui t’a fait perdre le plus.',
      'Les liquidités, l’immobilier et les biens sans cours de marché ne sont pas affichés.',
    ],
    source:
      'Table _history, colonnes Date, Instrument, Quantity, Assets Master Currency (et Asset, Envelope, Broker si présentes) : dernier relevé comparé au relevé d’il y a ' +
      `${period}.`,

    build(table) {
      const { latest, reference, lines } = priceChanges(table, months)
      if (!latest) return { empty: 'Aucun relevé daté dans la table _history.' }
      if (!reference) return { empty: `L’historique ne remonte pas encore à ${period} avant le dernier relevé (${formatDateLong(latest)}).` }
      if (!lines.length) {
        throw new DataError(
          `Aucun placement commun au ${formatDateLong(reference)} et au ${formatDateLong(latest)} avec une quantité et un montant renseignés.`,
        )
      }

      const total = lines.reduce((sum, line) => sum + line.amount, 0)
      const weighted = lines.reduce((sum, line) => sum + line.pct * line.amount, 0) / total
      const worst = lines[0]
      const best = lines[lines.length - 1]
      return {
        subtitle: `Du ${formatDateLong(reference)} au ${formatDateLong(latest)}.`,
        summary:
          `${plural(lines.length, 'placement')} comparés entre le ${formatDateLong(reference)} et le ${formatDateLong(latest)}. ` +
          `Variation moyenne pondérée par les montants : ${signedPercent(weighted)}. ` +
          `Variation la plus basse : ${worst.name} (${signedPercent(worst.pct)}) ; la plus haute : ${best.name} (${signedPercent(best.pct)}).`,
        option: bubbleOption(lines),
        height: 440,
        table: {
          columns: ['Placement', 'Enveloppe', 'Type', 'Montant', 'Variation du prix'],
          numeric: [false, false, false, true, true],
          rows: lines.map((line) => [line.name, line.envelope ? envelopeLabel(line.envelope) : '', capitalize(line.asset), euro(line.amount), signedPercent(line.pct)]),
        },
        note: `Variation moyenne pondérée par les montants : ${signedPercent(weighted)} sur ${euro(total)} de placements.`,
      }
    },
  }
}

export const VOLATILITY_CHARTS = [
  volatilitySpec({ months: 1, slug: 'volatilite-1-mois', title: 'Sur 1 mois', period: '1 mois' }),
  volatilitySpec({ months: 3, slug: 'volatilite-3-mois', title: 'Sur 3 mois', period: '3 mois' }),
  volatilitySpec({ months: 12, slug: 'volatilite-1-an', title: 'Sur 1 an', period: '1 an' }),
]
