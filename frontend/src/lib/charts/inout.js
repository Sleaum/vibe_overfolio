// Portfolio Flow : entrées, sorties et impôts mois par mois. Table `inout`, colonnes date, in, out et tax (facultative).

import { buildInOut, findColumn, requireColumns, rowsOf } from '../aggregate.js'
import { baseOption, categoryAxis, legendTop, tooltipBox, tooltipHtml, valueAxis, zoomSlider } from '../chartTheme.js'
import { axisEuroFormatter, euro, formatMonthKey } from '../format.js'
import { BLUE, HOVER_SHADE, NEGATIVE, NEGATIVE_2 } from '../palette.js'
import { dataSubtitle } from './common.js'
import { t, tList } from '../../i18n/index.js'

export function inoutOption(months, { hasTax }) {
  const max = Math.max(...months.map((month) => Math.max(month.inflow, month.outflow, hasTax ? month.tax : 0)))
  const zoom = months.length > 24
  const bar = (name, color, data) => ({
    name,
    type: 'bar',
    data,
    barMaxWidth: 18,
    barGap: '15%',
    barCategoryGap: '40%',
    itemStyle: { color, borderRadius: [4, 4, 0, 0] },
  })

  return {
    ...baseOption(),
    grid: { left: 4, right: 8, top: 40, bottom: zoom ? 44 : 8, containLabel: true },
    legend: legendTop(hasTax ? [t('charts.inout.in'), t('charts.inout.out'), t('charts.inout.tax')] : [t('charts.inout.in'), t('charts.inout.out')]),
    tooltip: tooltipBox({
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: HOVER_SHADE } },
      formatter: (params) => {
        const first = [].concat(params)[0]
        const month = months[first?.dataIndex]
        if (!month) return ''
        const rows = [
          { color: BLUE, label: t('charts.inout.in'), value: euro(month.inflow) },
          { color: NEGATIVE, label: t('charts.inout.out'), value: euro(month.outflow) },
        ]
        if (hasTax) rows.push({ color: NEGATIVE_2, label: t('charts.inout.tax'), value: euro(month.tax) })
        rows.push({ label: t('charts.inout.monthBalance'), value: euro(month.inflow - month.outflow - month.tax), strong: true })
        return tooltipHtml(formatMonthKey(month.key), rows)
      },
    }),
    xAxis: categoryAxis(months.map((month) => formatMonthKey(month.key))),
    yAxis: valueAxis(axisEuroFormatter(max)),
    dataZoom: zoom ? [zoomSlider()] : undefined,
    series: [
      bar(t('charts.inout.in'), BLUE, months.map((month) => Math.round(month.inflow))),
      bar(t('charts.inout.out'), NEGATIVE, months.map((month) => Math.round(month.outflow))),
      ...(hasTax ? [bar(t('charts.inout.tax'), NEGATIVE_2, months.map((month) => Math.round(month.tax)))] : []),
    ],
  }
}

export default {
  slug: 'entrees-sorties',
  get title() {
    return t('charts.inout.title')
  },
  get summary() {
    return t('charts.inout.summary')
  },
  table: 'inout',
  minWidth: 720,
  get explain() {
    return tList('charts.inout.explain')
  },
  get source() {
    return t('charts.inout.source')
  },

  build(table) {
    const cols = requireColumns(table, {
      date: ['date', 'mois', 'month'],
      inflow: ['in', 'entree', 'entrees'],
      outflow: ['out', 'sortie', 'sorties'],
    })
    const tax = findColumn(table.columns, ['tax', 'taxe', 'taxes', 'impot', 'impots'])
    const months = buildInOut(rowsOf(table), { ...cols, tax })
    if (!months.length) {
      return { empty: t('errors.noDates', { table: 'inout' }) }
    }

    const totalIn = months.reduce((sum, month) => sum + month.inflow, 0)
    const totalOut = months.reduce((sum, month) => sum + month.outflow, 0)
    const totalTax = months.reduce((sum, month) => sum + month.tax, 0)

    return {
      subtitle: dataSubtitle(table, 'subtitle.movesUntil'),
      summary: t(tax ? 'charts.inout.a11yTax' : 'charts.inout.a11y', {
        from: formatMonthKey(months[0].key),
        to: formatMonthKey(months[months.length - 1].key),
        in: euro(totalIn),
        out: euro(totalOut),
        tax: euro(totalTax),
      }),
      option: inoutOption(months, { hasTax: Boolean(tax) }),
      height: 400,
      table: {
        columns: [
          t('chart.month'),
          t('charts.inout.in'),
          t('charts.inout.out'),
          ...(tax ? [t('charts.inout.tax')] : []),
          t('charts.inout.balance'),
        ],
        numeric: [false, true, true, ...(tax ? [true] : []), true],
        rows: [
          ...[...months]
            .reverse()
            .map((m) => [
              formatMonthKey(m.key),
              euro(m.inflow),
              euro(m.outflow),
              ...(tax ? [euro(m.tax)] : []),
              euro(m.inflow - m.outflow - m.tax),
            ]),
          [t('chart.total'), euro(totalIn), euro(totalOut), ...(tax ? [euro(totalTax)] : []), euro(totalIn - totalOut - totalTax)],
        ],
      },
    }
  },
}
