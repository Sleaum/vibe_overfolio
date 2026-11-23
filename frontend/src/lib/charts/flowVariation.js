// Portfolio Flow 4 : variation du patrimoine d'un mois à l'autre, en %.
// Table `_history`, colonnes Date et Assets Master Currency : total des actifs au dernier relevé de chaque mois.

import { requireColumns, rowsOf } from '../aggregate.js'
import { axisLabelStyle, baseOption, categoryAxis, tooltipBox, tooltipHtml, valueAxis, zoomSlider } from '../chartTheme.js'
import { axisPercent, euro, formatMonthKey, formatMonthKeyTiny, percent } from '../format.js'
import { AXIS, BLUE, HOVER_SHADE, NEGATIVE } from '../palette.js'
import { monthEnds, monthsSubtitle, signedPercent, skippedNote, totalsByDate } from './flowData.js'
import { t, tList } from '../../i18n/index.js'

const UP = BLUE
const DOWN = NEGATIVE

export function variationOption(changes) {
  const zoom = changes.length > 30
  return {
    ...baseOption(),
    grid: { left: 4, right: 8, top: 16, bottom: zoom ? 44 : 8, containLabel: true },
    tooltip: tooltipBox({
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: HOVER_SHADE } },
      formatter: (params) => {
        const change = changes[[].concat(params)[0]?.dataIndex]
        if (!change) return ''
        return tooltipHtml(formatMonthKey(change.key), [
          { color: change.pct >= 0 ? UP : DOWN, label: t('charts.variation.change'), value: signedPercent(change.pct), strong: true },
          { label: t('charts.variation.gap'), value: `${change.delta > 0 ? '+' : change.delta < 0 ? '-' : ''}${euro(Math.abs(change.delta))}` },
          { label: t('chart.wealth'), value: euro(change.total) },
        ])
      },
    }),
    // Étiquettes de mois en bas du graphique (pas sur le zéro, où elles toucheraient les barres négatives)
    xAxis: categoryAxis(changes.map((change) => formatMonthKeyTiny(change.key)), {
      axisLine: { onZero: false, lineStyle: { color: AXIS } },
      axisLabel: { ...axisLabelStyle, hideOverlap: true },
    }),
    yAxis: valueAxis(axisPercent),
    dataZoom: zoom ? [zoomSlider()] : undefined,
    series: [
      {
        name: 'Variation',
        type: 'bar',
        // Ligne du zéro, un peu plus marquée que les filets
        markLine: {
          silent: true,
          symbol: 'none',
          label: { show: false },
          lineStyle: { color: AXIS, width: 1.5, type: 'solid' },
          data: [{ yAxis: 0 }],
        },
        barMaxWidth: 18,
        barCategoryGap: '40%',
        data: changes.map((change) => ({
          value: Math.round(change.pct * 100) / 100,
          itemStyle: {
            color: change.pct >= 0 ? UP : DOWN,
            // Le bout arrondi est du côté opposé à l'axe du zéro
            borderRadius: change.pct >= 0 ? [4, 4, 0, 0] : [0, 0, 4, 4],
          },
        })),
      },
    ],
  }
}

export default {
  slug: 'variation-mensuelle',
  amounts: true, // suit le bouton Brut / Net (lib/amounts.js)
  get title() {
    return t('charts.variation.title')
  },
  get summary() {
    return t('charts.variation.summary')
  },
  table: '_history',
  minWidth: 720,
  get explain() {
    return tList('charts.variation.explain')
  },
  get source() {
    return t('charts.variation.source')
  },

  build(table) {
    const cols = requireColumns(table, { date: ['Date'], value: ['Assets Master Currency'] })
    const rows = rowsOf(table)
    const totals = totalsByDate(rows, cols.date, cols.value)
    const ends = monthEnds(rows, cols.date)
    const months = ends.map((month) => ({ ...month, total: totals.get(month.iso) ?? 0 }))

    const changes = []
    for (let i = 1; i < months.length; i++) {
      const previous = months[i - 1].total
      if (!(previous > 0)) continue
      const delta = months[i].total - previous
      changes.push({ key: months[i].key, total: months[i].total, delta, pct: (delta / previous) * 100 })
    }
    if (!changes.length) return { empty: t('errors.twoMonths', { table: '_history' }) }

    const last = changes[changes.length - 1]
    return {
      subtitle: monthsSubtitle(ends),
      summary:
        t('charts.variation.a11y', {
          from: formatMonthKey(changes[0].key),
          to: formatMonthKey(last.key),
          last: signedPercent(last.pct),
        }),
      option: variationOption(changes),
      height: 320,
      table: {
        columns: [t('chart.month'), t('charts.variation.change'), t('charts.variation.gap'), t('chart.wealth')],
        numeric: [false, true, true, true],
        rows: [...changes]
          .reverse()
          .map((change) => [
            formatMonthKey(change.key),
            signedPercent(change.pct),
            `${change.delta > 0 ? '+' : change.delta < 0 ? '-' : ''}${euro(Math.abs(change.delta))}`,
            euro(change.total),
          ]),
      },
      note: [
        t('charts.variation.average', {
          value: signedPercent(changes.reduce((sum, change) => sum + change.pct, 0) / changes.length),
        }),
        skippedNote(ends.skipped),
      ].join(' '),
    }
  },
}
