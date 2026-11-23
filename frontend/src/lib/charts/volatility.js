// Page « Volatilité » (/volatilite) : comment le prix de chaque placement a bougé sur 1 mois, 3 mois et 1 an,
// comme la page « Portfolio Volatility » de l'ancien rapport Data Studio (une bulle par ligne : montant détenu et variation).
//
// Calcul, à partir de la table `history` avec le mois prochain (googlesheet/projection.py) :
// - prix unitaire d'une ligne = Assets Master Currency / Quantity ; il intègre donc le change (un titre en dollars bouge
//   aussi avec l'euro/dollar) mais pas tes achats ni tes ventes ;
// - point d'arrivée : tes positions actuelles (lignes tirées de portfolio par le serveur), à la date des positions ;
//   sans elles (mois déjà relevé dans la feuille), le dernier relevé de history ;
// - point de départ : le même jour, 1, 3 ou 12 mois plus tôt (23 novembre -> 23 octobre). history n'ayant en général
//   qu'un relevé par mois, le prix de ce jour-là est estimé entre les deux relevés qui l'encadrent, au prorata des jours
//   (le relevé lui-même s'il tombe ce jour-là) ;
// - une ligne = même Instrument, même enveloppe et même courtier aux deux dates ;
// - les liquidités, l'immobilier, les biens qui se déprécient et les objets (fiat, real estate, depreciating, exotic)
//   n'ont pas de cours : ils sont écartés ;
// - une ligne actuelle sans prix au point de départ (placement plus récent) n'a pas de variation : elle est nommée dans
//   la note sous le graphique (`missing`).
// Chaque bulle porte son nom ; un même instrument dans plusieurs enveloppes (MSCI World en PEA, CTO et PER) porte aussi
// son enveloppe. Deux bulles presque identiques se superposent : leurs noms sont décalés pour rester lisibles.

import { DataError, findColumn, requireColumns, rowsOf, toLabel, toNumber } from '../aggregate.js'
import { axisLabelStyle, baseOption, tooltipBox, tooltipHtml } from '../chartTheme.js'
import { isoToTimestamp, toIsoDate } from '../dates.js'
import { axisPercent, capitalize, currencyLabel, formatAmount, formatDateLong } from '../format.js'
import { envelopeLabel } from './envelopes.js'
import { AXIS, GRID, INK_2, SURFACE, assignAssetColors } from '../palette.js'
import { compactNumber, signedPercent } from './flowData.js'
import { t } from '../../i18n/index.js'

const NOT_QUOTED = new Set(['fiat', 'real estate', 'depreciating', 'exotic', 'cash', 'liquidités'])

const lower = (text) => String(text ?? '').trim().toLowerCase()

/** "AAAA-MM-JJ" décalée de `months` mois en arrière, le même jour (ramené à la fin du mois : 31 mars -> 28 février). */
export function monthsBefore(iso, months) {
  const [y, m, d] = iso.split('-').map(Number)
  const first = new Date(Date.UTC(y, m - 1 - months, 1))
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
  first.setUTCDate(Math.min(d, lastDay))
  return first.toISOString().slice(0, 10)
}

/**
 * Variation du prix unitaire de chaque ligne entre le point de départ (même jour, `months` mois plus tôt) et le point
 * d'arrivée (positions actuelles, sinon dernier relevé).
 * Retourne { latest, reference, lines: [{ name, envelope, asset, amount, before, after, pct }], missing: [noms],
 * current (prix d'arrivée = positions actuelles), estimated: { before, after } | null (relevés qui encadrent le départ) } ;
 * reference = '' si l'historique ne remonte pas assez loin.
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
  const projection = table?.projection?.rows ? table.projection : null
  const empty = { latest: '', reference: '', lines: [], missing: [], current: false, estimated: null }

  const keyOf = (row) =>
    [row[cols.instrument], envelope ? row[envelope] : '', broker ? row[broker] : ''].map(lower).join('|')

  // Montants et quantités par date et par ligne ; les lignes du mois prochain (positions actuelles) à part
  const records = new Map()
  const current = new Map()
  for (const row of rowsOf(table)) {
    const iso = toIsoDate(row[cols.date])
    if (!iso || !toLabel(row[cols.instrument], '')) continue
    if (asset && NOT_QUOTED.has(lower(row[asset]))) continue
    const amount = toNumber(row[cols.value])
    const quantity = toNumber(row[cols.quantity])
    if (!(amount > 0 && quantity > 0)) continue
    const target = projection && iso === projection.date ? current : records.get(iso) ?? records.set(iso, new Map()).get(iso)
    const key = keyOf(row)
    const sum = target.get(key)
    // Deux lignes identiques le même jour (achats successifs) : on additionne montants et quantités
    target.set(key, { row, amount: (sum?.amount ?? 0) + amount, quantity: (sum?.quantity ?? 0) + quantity })
  }

  // Point d'arrivée : positions actuelles à leur date, sinon le dernier relevé
  const dates = [...records.keys()].sort()
  const useCurrent = current.size > 0
  const latest = useCurrent ? projection.source_date : dates[dates.length - 1]
  if (!latest) return empty
  const end = useCurrent ? current : records.get(latest)
  const points = [...dates.filter((iso) => iso < latest).map((iso) => [iso, records.get(iso)]), [latest, end]]

  // Point de départ : le même jour, `months` mois plus tôt, estimé entre les deux relevés qui l'encadrent
  const reference = monthsBefore(latest, months)
  const exact = points.find(([iso]) => iso === reference)
  const previous = [...points].reverse().find(([iso]) => iso < reference)
  const next = points.find(([iso]) => iso > reference)
  if (!exact && !previous) return { ...empty, latest, current: useCurrent }
  const price = (entry) => (entry ? entry.amount / entry.quantity : null)
  const weight = exact ? 0 : (isoToTimestamp(reference) - isoToTimestamp(previous[0])) / (isoToTimestamp(next[0]) - isoToTimestamp(previous[0]))
  const priceAtReference = (key) => {
    if (exact) return price(exact[1].get(key))
    const before = price(previous[1].get(key))
    const after = price(next[1].get(key))
    return before === null || after === null ? null : before + (after - before) * weight
  }

  const lines = []
  const missing = []
  for (const [key, now] of end) {
    const priceBefore = priceAtReference(key)
    if (priceBefore === null) {
      const name = envelopeLabel(toLabel(now.row[cols.instrument]))
      missing.push(envelope && toLabel(now.row[envelope], '') ? `${name} (${envelopeLabel(toLabel(now.row[envelope]))})` : name)
      continue
    }
    const priceAfter = price(now)
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
  return {
    latest,
    reference,
    lines,
    missing,
    current: useCurrent,
    estimated: exact ? null : { before: previous[0], after: next[0] },
  }
}

export function bubbleOption(lines) {
  const { colors } = assignAssetColors([...new Set(lines.map((line) => line.asset))])
  const maxAmount = Math.max(...lines.map((line) => line.amount))
  const size = (amount) => 8 + 40 * Math.sqrt(amount / maxAmount)
  const assets = [...new Set(lines.map((line) => line.asset))].sort(
    (a, b) => (colors.get(a)?.slot ?? 99) - (colors.get(b)?.slot ?? 99),
  )
  // Nom de la bulle ; l'enveloppe s'ajoute quand le même instrument est détenu dans plusieurs enveloppes
  const count = new Map()
  for (const line of lines) count.set(line.name, (count.get(line.name) ?? 0) + 1)
  const bubbleName = (line) =>
    count.get(line.name) > 1 && line.envelope ? `${line.name} · ${envelopeLabel(line.envelope)}` : line.name

  // Bulles presque au même endroit (même variation à 0,5 point près, montants proches) : leurs noms sont écartés
  // verticalement, l'un au-dessus de l'autre, pour rester lisibles
  const near = (a, b) => Math.abs(a.pct - b.pct) < 0.5 && Math.abs(Math.log10(Math.max(a.amount, 1) / Math.max(b.amount, 1))) < 0.15
  const clusters = []
  for (const line of lines) {
    const cluster = clusters.find((group) => group.some((other) => near(line, other)))
    if (cluster) cluster.push(line)
    else clusters.push([line])
  }
  const labelOffset = new Map()
  for (const cluster of clusters) {
    cluster.sort((a, b) => b.pct - a.pct)
    cluster.forEach((line, index) => labelOffset.set(line, [0, (index - (cluster.length - 1) / 2) * 14]))
  }

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
          { label: t('charts.volatility.held'), value: formatAmount(line.amount) },
          { label: t('charts.volatility.priceBefore'), value: formatAmount(line.before) },
          { label: t('charts.volatility.priceNow'), value: formatAmount(line.after) },
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
      // Bulles un peu transparentes : deux bulles superposées restent visibles toutes les deux
      itemStyle: { color: colors.get(name)?.color, opacity: 0.7, borderColor: SURFACE, borderWidth: 1 },
      emphasis: { focus: 'series' },
      label: {
        show: true,
        position: 'right',
        distance: 4,
        color: INK_2,
        fontSize: 11,
        formatter: (p) => (p?.data?.line ? bubbleName(p.data.line) : ''),
      },
      data: lines
        .filter((line) => line.asset === name)
        .map((line) => ({
          value: [Math.max(line.amount, 1), Number(line.pct.toFixed(2))],
          symbolSize: size(line.amount),
          label: { offset: labelOffset.get(line) },
          line,
        })),
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
    table: 'history',
    projection: 'positions', // + positions actuelles (mois prochain du serveur), comptées à leur date : point d'arrivée
    minWidth: 640,
    get explain() {
      return [
        t('charts.volatility.explain1', { period: period() }),
        t('charts.volatility.explain2', { currency: currencyLabel() }),
        t('charts.volatility.explain3'),
      ]
    },
    get source() {
      return t('charts.volatility.source', { period: period() })
    },

    build(table) {
      const { latest, reference, lines, missing, current, estimated } = priceChanges(table, months)
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
          rows: lines.map((line) => [line.name, line.envelope ? envelopeLabel(line.envelope) : '', capitalize(line.asset), formatAmount(line.amount), signedPercent(line.pct)]),
        },
        note: [
          t('charts.volatility.note', { weighted: signedPercent(weighted), total: formatAmount(total) }),
          missing.length
            ? t('charts.volatility.missing', { date: formatDateLong(reference), names: missing.join(', ') }, missing.length)
            : '',
          current ? t('charts.volatility.current', { date: formatDateLong(latest) }) : '',
          estimated
            ? t('charts.volatility.estimated', {
                date: formatDateLong(reference),
                before: formatDateLong(estimated.before),
                after: formatDateLong(estimated.after),
              })
            : '',
        ]
          .filter(Boolean)
          .join(' '),
      }
    },
  }
}

export const VOLATILITY_CHARTS = [
  volatilitySpec({ months: 1, slug: 'volatilite-1-mois' }),
  volatilitySpec({ months: 3, slug: 'volatilite-3-mois' }),
  volatilitySpec({ months: 12, slug: 'volatilite-1-an' }),
]
