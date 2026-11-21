// Portfolio Flow : entrées, sorties et impôts mois par mois. Table `inout`, colonnes date, in, out et tax (facultative).

import { buildInOut, findColumn, requireColumns, rowsOf } from '../aggregate.js'
import { baseOption, categoryAxis, legendTop, tooltipBox, tooltipHtml, valueAxis, zoomSlider } from '../chartTheme.js'
import { axisEuroFormatter, euro, formatMonthKey } from '../format.js'
import { SERIES } from '../palette.js'
import { dataSubtitle } from './common.js'

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
    legend: legendTop(hasTax ? ['Entrées', 'Sorties', 'Impôts'] : ['Entrées', 'Sorties']),
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
        ]
        if (hasTax) rows.push({ color: SERIES[3], label: 'Impôts', value: euro(month.tax) })
        rows.push({ label: 'Solde du mois', value: euro(month.inflow - month.outflow - month.tax), strong: true })
        return tooltipHtml(formatMonthKey(month.key), rows)
      },
    }),
    xAxis: categoryAxis(months.map((month) => formatMonthKey(month.key))),
    yAxis: valueAxis(axisEuroFormatter(max)),
    dataZoom: zoom ? [zoomSlider()] : undefined,
    series: [
      bar('Entrées', SERIES[0], months.map((month) => Math.round(month.inflow))),
      bar('Sorties', SERIES[1], months.map((month) => Math.round(month.outflow))),
      ...(hasTax ? [bar('Impôts', SERIES[3], months.map((month) => Math.round(month.tax)))] : []),
    ],
  }
}

export default {
  slug: 'entrees-sorties',
  title: 'Entrées, sorties et impôts',
  summary: 'L’argent que tu verses, que tu retires et les impôts payés, mois par mois.',
  table: 'inout',
  minWidth: 720,
  explain: [
    'Pour chaque mois, la barre bleue totalise l’argent versé sur tes placements (in), la barre orange l’argent retiré (out) et la barre jaune les impôts (tax). Les mois sans mouvement apparaissent à zéro.',
    'Le solde du mois (entrées moins sorties et impôts) se lit dans l’infobulle et dans la vue en tableau. Il explique la part de la variation mensuelle qui ne vient pas du marché.',
  ],
  source: 'Table inout, colonnes date, in, out et tax. Les sorties et les impôts saisis en négatif sont comptés en valeur absolue.',

  build(table) {
    const cols = requireColumns(table, {
      date: ['date', 'mois', 'month'],
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
      summary:
        `Barres par mois entre ${formatMonthKey(months[0].key)} et ${formatMonthKey(months[months.length - 1].key)} : ` +
        `${euro(totalIn)} d’entrées, ${euro(totalOut)} de sorties${tax ? ` et ${euro(totalTax)} d’impôts` : ''} au total.`,
      option: inoutOption(months, { hasTax: Boolean(tax) }),
      height: 400,
      table: {
        columns: ['Mois', 'Entrées', 'Sorties', ...(tax ? ['Impôts'] : []), 'Solde'],
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
          ['Total', euro(totalIn), euro(totalOut), ...(tax ? [euro(totalTax)] : []), euro(totalIn - totalOut - totalTax)],
        ],
      },
    }
  },
}
