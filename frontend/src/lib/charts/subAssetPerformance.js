// Snapshot : variation du prix de chaque sous-type de placement (stock, bitcoin, gold, ETF…) sur les périodes choisies,
// en jours (lib/performanceWindows.js : 30, 90 et 365 par défaut).
//
// - Même calcul que Volatility (priceChanges de volatility.js) : prix actuels (positions de portfolio, à leur date)
//   comparés à ceux du même placement N jours plus tôt, estimés entre ses deux relevés de history qui encadrent ce jour ;
//   les placements sans cours (liquidités, immobilier, biens, objets) sont écartés.
// - Regroupement par « Sub Asset » ; les ETF sont séparés par instrument (ETF msci world, ETF dbmfe…).
// - Variation d'un groupe = variation de sa valeur à quantités constantes (celles d'aujourd'hui) :
//   somme des montants actuels ÷ somme des montants au prix de départ − 1. Les achats et ventes ne comptent pas.
// - Un placement sans prix de départ (acheté depuis) ne compte pas pour cette période ; il est nommé dans la note.

import { DataError } from '../aggregate.js'
import { baseOption, categoryAxis, legendTop, tooltipBox, tooltipHtml, valueAxis } from '../chartTheme.js'
import { axisPercent, capitalize, formatAmount, formatDateLong } from '../format.js'
import { HOVER_SHADE, blues, reds } from '../palette.js'
import { daysBefore, priceChanges } from './volatility.js'
import { signedPercent } from './flowData.js'
import { performanceDays, performanceWindows } from '../performanceWindows.js'
import { t, tList } from '../../i18n/index.js'

const lower = (text) => String(text ?? '').trim().toLowerCase()

/** Durée lisible : « 1 jour », « 30 jours ». */
export const daysLabel = (days) => t('subAssetPerformance.days', { count: days }, days)

/** Groupe d'un placement : son sous-type, et pour un ETF son instrument. */
function groupOf(line) {
  const sub = line.subAsset || line.asset
  if (lower(sub) === 'etf') return { key: `etf|${lower(line.instrument)}`, label: `ETF ${line.instrument}` }
  return { key: lower(sub), label: capitalize(sub) }
}

/**
 * Variation par groupe et par période : { latest, groups: [{ key, label, amount, changes: [pct | null] }],
 * missing: [[période, noms]] }. Groupes rangés du plus gros montant actuel au plus petit.
 */
export function performanceByGroup(table, periods) {
  const groups = new Map()
  const missing = []
  let latest = ''
  periods.forEach((days, index) => {
    const result = priceChanges(table, null, (end) => daysBefore(end, days))
    latest = result.latest || latest
    if (result.missing.length) missing.push([days, result.missing])
    for (const line of result.lines) {
      const { key, label } = groupOf(line)
      const group = groups.get(key) ?? { key, label, amount: 0, sums: periods.map(() => ({ now: 0, then: 0 })) }
      // Montant au prix de départ, à la quantité d'aujourd'hui
      group.sums[index].now += line.amount
      group.sums[index].then += (line.amount * line.before) / line.after
      groups.set(key, group)
    }
  })
  // Montant actuel d'un groupe : celui de la période qui compare le plus de ses placements
  const list = [...groups.values()].map((group) => {
    const changes = group.sums.map((sum) => (sum.then > 0 ? (sum.now / sum.then - 1) * 100 : null))
    const amount = Math.max(...group.sums.map((sum) => sum.now))
    return { key: group.key, label: group.label, amount, changes }
  })
  list.sort((a, b) => b.amount - a.amount)
  return { latest, groups: list, missing }
}

export function performanceOption(groups, periods) {
  const up = blues(periods.length)
  const down = reds(periods.length)
  const names = periods.map(daysLabel)
  return {
    ...baseOption(),
    grid: { left: 4, right: 8, top: 40, bottom: 8, containLabel: true },
    legend: legendTop(names),
    tooltip: tooltipBox({
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: HOVER_SHADE } },
      formatter: (params) => {
        const group = groups[[].concat(params)[0]?.dataIndex]
        if (!group) return ''
        return tooltipHtml(
          group.label,
          group.changes.map((pct, i) => ({
            color: pct !== null && pct < 0 ? down[i] : up[i],
            label: names[i],
            value: pct === null ? t('subAssetPerformance.noPrice') : signedPercent(pct),
          })),
        )
      },
    }),
    xAxis: categoryAxis(groups.map((group) => group.label)),
    yAxis: valueAxis(axisPercent),
    series: periods.map((days, i) => ({
      name: names[i],
      type: 'bar',
      color: up[i],
      barMaxWidth: 18,
      barGap: '12%',
      barCategoryGap: '30%',
      data: groups.map((group) => {
        const pct = group.changes[i]
        if (pct === null) return null
        return { value: Number(pct.toFixed(2)), itemStyle: { color: pct < 0 ? down[i] : up[i], borderRadius: pct < 0 ? [0, 0, 3, 3] : [3, 3, 0, 0] } }
      }),
    })),
  }
}

export default {
  slug: 'performance-sous-types',
  get title() {
    return t('subAssetPerformance.title')
  },
  get summary() {
    return t('subAssetPerformance.summary')
  },
  table: 'history',
  projection: 'positions', // + positions actuelles (portfolio), comptées à leur date : point d'arrivée
  windows: { store: performanceWindows, format: daysLabel, unit: 'days', testid: 'performance-windows' }, // pastilles
  minWidth: 560,
  get explain() {
    return tList('subAssetPerformance.explain')
  },
  get source() {
    return t('subAssetPerformance.source')
  },

  build(table) {
    const periods = performanceDays.value
    const { latest, groups, missing } = performanceByGroup(table, periods)
    if (!latest) return { empty: t('charts.envelopes.noRecord') }
    if (!groups.length) {
      throw new DataError(t('subAssetPerformance.noCommon', { date: formatDateLong(latest) }))
    }
    const names = periods.map(daysLabel)
    return {
      subtitle: t('subAssetPerformance.range', { date: formatDateLong(latest), periods: names.join(', ') }),
      summary: t('subAssetPerformance.a11y', {
        date: formatDateLong(latest),
        groups: groups
          .map((group) => `${group.label} ${group.changes.map((pct, i) => `${names[i]} ${pct === null ? '–' : signedPercent(pct)}`).join(', ')}`)
          .join(' ; '),
      }),
      option: performanceOption(groups, periods),
      height: 380,
      table: {
        columns: [t('subAssetPerformance.group'), t('chart.amount'), ...names],
        numeric: [false, true, ...names.map(() => true)],
        rows: groups.map((group) => [
          group.label,
          formatAmount(group.amount),
          ...group.changes.map((pct) => (pct === null ? '–' : signedPercent(pct))),
        ]),
      },
      note: [
        t('subAssetPerformance.note', { date: formatDateLong(latest) }),
        ...missing.map(([days, list]) => t('subAssetPerformance.missing', { period: daysLabel(days), names: list.join(', ') }, list.length)),
      ].join(' '),
    }
  },
}
