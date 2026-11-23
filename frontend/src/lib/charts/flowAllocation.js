// Portfolio Flow 2 : répartition du patrimoine par type d'actif, en % de chaque mois (barres empilées à 100 %).
// Table `history`, colonnes Date, Asset et Assets Master Currency.

import { requireColumns, rowsOf } from '../aggregate.js'
import { baseOption, categoryAxis, legendTop, tooltipBox, tooltipHtml, valueAxis, zoomSlider } from '../chartTheme.js'
import { axisPercent, formatAmount, formatMonthKey, formatMonthKeyTiny, percent } from '../format.js'
import { HOVER_SHADE, SURFACE } from '../palette.js'
import { assetMonthly, monthsSubtitle, skippedNote } from './flowData.js'
import { t, tList } from '../../i18n/index.js'

export function allocationOption(model) {
  const { months, series, values, totals } = model
  const zoom = months.length > 30
  const share = (s, m) => (totals[m] > 0 ? (values[s][m] / totals[m]) * 100 : 0)
  // Dernier segment non nul de chaque barre : c'est lui qui a le haut arrondi
  const topSegment = months.map((_, m) => series.reduce((last, _s, s) => (values[s][m] > 0 ? s : last), -1))

  return {
    ...baseOption(),
    grid: { left: 4, right: 8, top: 56, bottom: zoom ? 44 : 8, containLabel: true },
    legend: legendTop(series.map((serie) => serie.label)),
    tooltip: tooltipBox({
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: HOVER_SHADE } },
      formatter: (params) => {
        const m = [].concat(params)[0]?.dataIndex
        if (months[m] === undefined) return ''
        const rows = series
          .map((serie, s) => ({ serie, value: values[s][m] }))
          .filter((item) => item.value > 0)
          .reverse() // même ordre que la pile : le haut de la barre en premier
          .map((item) => ({
            color: item.serie.color,
            label: item.serie.label,
            value: `${percent(item.value / totals[m])} · ${formatAmount(item.value)}`,
          }))
        rows.push({ label: t('chart.total'), value: formatAmount(totals[m]), strong: true })
        return tooltipHtml(formatMonthKey(months[m].key), rows)
      },
    }),
    xAxis: categoryAxis(months.map((month) => formatMonthKeyTiny(month.key))),
    yAxis: valueAxis(axisPercent, { min: 0, max: 100, interval: 20 }),
    dataZoom: zoom ? [zoomSlider()] : undefined,
    series: series.map((serie, s) => ({
      name: serie.label,
      type: 'bar',
      stack: 'total',
      barMaxWidth: 22,
      barCategoryGap: '30%',
      // Écart de 2 px entre segments : un filet de la couleur du fond
      itemStyle: { color: serie.color, borderColor: SURFACE, borderWidth: 2 },
      data: months.map((_, m) => {
        const value = share(s, m)
        if (!(value > 0)) return null
        return topSegment[m] === s ? { value, itemStyle: { borderRadius: [4, 4, 0, 0] } } : value
      }),
    })),
  }
}

export default {
  slug: 'repartition-mensuelle',
  amounts: true, // suit le bouton Brut / Net (lib/amounts.js)
  get title() {
    return t('charts.allocation.title')
  },
  get summary() {
    return t('charts.allocation.summary')
  },
  table: 'history',
  projection: true, // + le mois prochain, tiré de portfolio (googlesheet/projection.py)
  minWidth: 720,
  get explain() {
    return tList('charts.allocation.explain')
  },
  get source() {
    return t('charts.allocation.source')
  },

  build(table) {
    const cols = requireColumns(table, { date: ['Date'], asset: ['Asset'], value: ['Assets Master Currency'] })
    const model = assetMonthly(rowsOf(table), cols.date, cols.asset, cols.value)
    if (!model.months.length) return { empty: t('errors.noPositive', { table: 'history' }) }

    const last = model.months.length - 1
    const biggest = model.series
      .map((serie, s) => ({ serie, value: model.values[s][last] }))
      .sort((a, b) => b.value - a.value)[0]

    return {
      subtitle: monthsSubtitle(model.months),
      summary:
        t('charts.allocation.a11y', {
          from: formatMonthKey(model.months[0].key),
          to: formatMonthKey(model.months[last].key),
          asset: biggest.serie.label,
          share: percent(biggest.value / model.totals[last]),
        }),
      option: allocationOption(model),
      height: 400,
      table: {
        columns: [t('chart.month'), ...model.series.map((serie) => serie.label), t('chart.total')],
        numeric: [false, ...model.series.map(() => true), true],
        rows: model.months
          .map((month, m) => [
            formatMonthKey(month.key),
            ...model.series.map((_, s) => (model.values[s][m] > 0 ? percent(model.values[s][m] / model.totals[m]) : '–')),
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
