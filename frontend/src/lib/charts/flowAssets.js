// Portfolio Flow 3 : montant de chaque type d'actif, une courbe par type, mois par mois.
// Table `history`, colonnes Date, Asset et Assets Master Currency.

import { requireColumns, rowsOf } from '../aggregate.js'
import { baseOption, categoryAxis, legendTop, tooltipBox, tooltipHtml, valueAxis, zoomSlider } from '../chartTheme.js'
import { axisAmountFormatter, formatAmount, formatMonthKey, formatMonthKeyTiny } from '../format.js'
import { AXIS, SURFACE } from '../palette.js'
import { assetMonthly, monthsSubtitle, skippedNote } from './flowData.js'
import { t, tList } from '../../i18n/index.js'

export function assetsLinesOption(model) {
  const { months, series, values, totals } = model
  const zoom = months.length > 30
  const max = Math.max(...values.flat())

  return {
    ...baseOption(),
    grid: { left: 4, right: 16, top: 56, bottom: zoom ? 44 : 8, containLabel: true },
    legend: legendTop(series.map((serie) => serie.label), { line: true }),
    tooltip: tooltipBox({
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: AXIS, width: 1, type: 'solid' } },
      formatter: (params) => {
        const m = [].concat(params)[0]?.dataIndex
        if (months[m] === undefined) return ''
        // Du plus gros au plus petit : on lit tout de suite l'essentiel
        const rows = series
          .map((serie, s) => ({ serie, value: values[s][m] }))
          .filter((item) => item.value > 0)
          .sort((a, b) => b.value - a.value)
          .map((item) => ({ color: item.serie.color, label: item.serie.label, value: formatAmount(item.value) }))
        rows.push({ label: t('chart.total'), value: formatAmount(totals[m]), strong: true })
        return tooltipHtml(formatMonthKey(months[m].key), rows)
      },
    }),
    xAxis: categoryAxis(months.map((month) => formatMonthKeyTiny(month.key)), { boundaryGap: false }),
    yAxis: valueAxis(axisAmountFormatter(max)),
    dataZoom: zoom ? [zoomSlider()] : undefined,
    series: series.map((serie, s) => ({
      name: serie.label,
      type: 'line',
      data: values[s].map((value) => Math.round(value)),
      showSymbol: false,
      symbol: 'circle',
      symbolSize: 8,
      lineStyle: { width: 2, color: serie.color },
      itemStyle: { color: serie.color, borderColor: SURFACE, borderWidth: 2 },
      emphasis: { focus: 'series', lineStyle: { width: 3 } },
    })),
  }
}

export default {
  slug: 'evolution-par-actif',
  amounts: true, // suit le bouton Brut / Net (lib/amounts.js)
  get title() {
    return t('charts.assets.title')
  },
  get summary() {
    return t('charts.assets.summary')
  },
  table: 'history',
  projection: true, // + le mois prochain, tiré de portfolio (wealth/projection.py)
  minWidth: 720,
  get explain() {
    return tList('charts.assets.explain')
  },
  get source() {
    return t('charts.assets.source')
  },

  build(table) {
    const cols = requireColumns(table, { date: ['Date'], asset: ['Asset'], value: ['Assets Master Currency'] })
    const model = assetMonthly(rowsOf(table), cols.date, cols.asset, cols.value)
    if (model.months.length < 2) return { empty: t('errors.twoMonths', { table: 'history' }) }

    const last = model.months.length - 1
    return {
      subtitle: monthsSubtitle(model.months),
      summary:
        t('charts.assets.a11y', {
          count: model.series.length,
          from: formatMonthKey(model.months[0].key),
          to: formatMonthKey(model.months[last].key),
          total: formatAmount(model.totals[last]),
        }),
      option: assetsLinesOption(model),
      height: 400,
      table: {
        columns: [t('chart.month'), ...model.series.map((serie) => serie.label), t('chart.total')],
        numeric: [false, ...model.series.map(() => true), true],
        rows: model.months
          .map((month, m) => [
            formatMonthKey(month.key),
            ...model.series.map((_, s) => formatAmount(model.values[s][m])),
            formatAmount(model.totals[m]),
          ])
          .reverse(),
      },
      note: [
        model.series.some((serie) => serie.label === t('data.others'))
          ? t('charts.flow.othersNote', { others: t('data.others') })
          : '',
        skippedNote(model.skipped),
      ]
        .filter(Boolean)
        .join(' '),
    }
  },
}
