// 7. Entrées et sorties : table `inout`, colonnes date, in, out (et tax), barres par mois.

import { buildInOut, findColumn, requireColumns, rowsOf } from '../aggregate.js'
import { baseOption, categoryAxis, legendTop, tooltipBox, tooltipHtml, valueAxis, zoomSlider } from '../chartTheme.js'
import { axisEuroFormatter, euro, formatMonthKey } from '../format.js'
import { SERIES } from '../palette.js'
import { dataSubtitle } from './common.js'

export function inoutOption(months, { hasTax }) {
  const max = Math.max(...months.map((month) => Math.max(month.inflow, month.outflow)))
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
    legend: legendTop(['Entrées', 'Sorties']),
    tooltip: tooltipBox({
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(31, 35, 40, 0.04)' } },
      formatter: (params) => {
        const first = [].concat(params)[0]
        const month = months[first?.dataIndex]
        if (!month) return ''
        const rows = [
          { color: SERIES[0], label: 'Entrées', value: euro(month.inflow) },
          { color: SERIES[1], label: 'Sorties', value: euro(month.outflow) },
          { label: 'Solde du mois', value: euro(month.inflow - month.outflow), strong: true },
        ]
        if (hasTax && month.tax) rows.push({ label: 'Taxes', value: euro(month.tax) })
        return tooltipHtml(formatMonthKey(month.key), rows)
      },
    }),
    xAxis: categoryAxis(months.map((month) => formatMonthKey(month.key))),
    yAxis: valueAxis(axisEuroFormatter(max)),
    dataZoom: zoom ? [zoomSlider()] : undefined,
    series: [
      bar('Entrées', SERIES[0], months.map((month) => Math.round(month.inflow))),
      bar('Sorties', SERIES[1], months.map((month) => Math.round(month.outflow))),
    ],
  }
}

export default {
  slug: 'entrees-sorties',
  title: 'Entrées et sorties',
  summary: 'L’argent qui entre et qui sort, mois par mois.',
  group: 'evolution',
  thumb: 'grouped',
  table: 'inout',
  explain: [
    'Pour chaque mois, la barre bleue totalise les entrées d’argent et la barre orange les sorties. Les mois sans mouvement apparaissent à zéro.',
    'Le solde du mois (entrées moins sorties) se lit dans l’infobulle et dans la vue en tableau.',
  ],
  source: 'Table inout, colonnes date, in, out et tax (les taxes sont indiquées dans l’infobulle).',

  build(table) {
    const cols = requireColumns(table, {
      date: ['date'],
      inflow: ['in', 'entree', 'entrees'],
      outflow: ['out', 'sortie', 'sorties'],
    })
    const tax = findColumn(table.columns, ['tax', 'taxe', 'taxes', 'impot', 'impots'])
    const months = buildInOut(rowsOf(table), { ...cols, tax })
    if (!months.length) {
      return { empty: 'Aucune date exploitable dans la table inout.' }
    }

    const totalIn = months.reduce((sum, month) => sum + month.inflow, 0)
    const totalOut = months.reduce((sum, month) => sum + month.outflow, 0)
    const totalTax = months.reduce((sum, month) => sum + month.tax, 0)

    return {
      subtitle: dataSubtitle(table, 'Mouvements jusqu’au'),
      summary: `Barres par mois entre ${formatMonthKey(months[0].key)} et ${formatMonthKey(months[months.length - 1].key)} : ${euro(totalIn)} d’entrées et ${euro(totalOut)} de sorties au total.`,
      option: inoutOption(months, { hasTax: Boolean(tax) }),
      height: 400,
      table: {
        columns: ['Mois', 'Entrées', 'Sorties', 'Solde', ...(tax ? ['Taxes'] : [])],
        numeric: [false, true, true, true, ...(tax ? [true] : [])],
        rows: [
          ...[...months]
            .reverse()
            .map((m) => [formatMonthKey(m.key), euro(m.inflow), euro(m.outflow), euro(m.inflow - m.outflow), ...(tax ? [euro(m.tax)] : [])]),
          ['Total', euro(totalIn), euro(totalOut), euro(totalIn - totalOut), ...(tax ? [euro(totalTax)] : [])],
        ],
      },
    }
  },
}
