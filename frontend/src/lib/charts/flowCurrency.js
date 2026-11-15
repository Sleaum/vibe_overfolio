// Portfolio Flow 1 : patrimoine exprimé en CHF, EUR et USD, un groupe de barres par mois.
// Table `_history` : une colonne de montants par devise (par exemple « Assets CHF »).

import { DataError, requireColumns, rowsOf } from '../aggregate.js'
import { baseOption, categoryAxis, legendTop, tooltipBox, tooltipHtml, valueAxis, zoomSlider } from '../chartTheme.js'
import { formatMonthKey, formatMonthKeyTiny } from '../format.js'
import { SERIES } from '../palette.js'
import { compactNumber, findCurrencyColumn, money, monthEnds, monthsSubtitle, skippedNote, totalsByDate } from './flowData.js'

// Une couleur par devise, la même partout : l'euro garde la première teinte du site
const CURRENCIES = [
  { code: 'CHF', color: SERIES[2] },
  { code: 'EUR', color: SERIES[0] },
  { code: 'USD', color: SERIES[1] },
]

export function currencyOption(months, series) {
  const zoom = months.length > 30
  return {
    ...baseOption(),
    grid: { left: 4, right: 8, top: 40, bottom: zoom ? 44 : 8, containLabel: true },
    legend: legendTop(series.map((serie) => serie.code)),
    tooltip: tooltipBox({
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(31, 35, 40, 0.04)' } },
      formatter: (params) => {
        const index = [].concat(params)[0]?.dataIndex
        const month = months[index]
        if (!month) return ''
        return tooltipHtml(
          formatMonthKey(month.key),
          series.map((serie) => ({ color: serie.color, label: serie.code, value: money(serie.values[index], serie.code) })),
        )
      },
    }),
    xAxis: categoryAxis(months.map((month) => formatMonthKeyTiny(month.key))),
    yAxis: valueAxis(compactNumber),
    dataZoom: zoom ? [zoomSlider()] : undefined,
    series: series.map((serie) => ({
      name: serie.code,
      type: 'bar',
      barMaxWidth: 14,
      barGap: '12%',
      barCategoryGap: '35%',
      itemStyle: { color: serie.color, borderRadius: [3, 3, 0, 0] },
      data: serie.values.map((value) => Math.round(value)),
    })),
  }
}

export default {
  slug: 'patrimoine-devises',
  title: 'Patrimoine par devise',
  summary: 'La valeur de ton patrimoine exprimée en CHF, en euros et en dollars, mois par mois.',
  table: '_history',
  minWidth: 720,
  explain: [
    'Pour chaque mois, trois barres donnent la valeur totale de ton patrimoine exprimée dans chaque devise. Ce n’est pas une répartition : c’est le même patrimoine, converti trois fois.',
    'Les barres changent donc ensemble ; leur écart ne bouge qu’avec les taux de change. Le montant d’un mois est celui du dernier relevé de ce mois.',
  ],
  source:
    'Table _history, colonne Date et une colonne de montants pour chaque devise (CHF, EUR, USD), additionnées par date.',

  build(table) {
    const cols = requireColumns(table, { date: ['Date'] })
    const found = CURRENCIES.map((currency) => ({
      ...currency,
      column: findCurrencyColumn(table.columns, currency.code),
    })).filter((currency) => currency.column)

    if (!found.length) {
      throw new DataError(
        `Aucune colonne de montants en CHF, EUR ou USD dans la table « ${table?.name ?? '_history'} ». ` +
          `Colonnes disponibles : ${(table?.columns ?? []).join(', ') || 'aucune'}.`,
      )
    }

    const rows = rowsOf(table)
    const months = monthEnds(rows, cols.date)
    if (!months.length) return { empty: 'Aucune date exploitable dans la table _history.' }

    const series = found.map((currency) => {
      const totals = totalsByDate(rows, cols.date, currency.column)
      return { ...currency, values: months.map((month) => totals.get(month.iso) ?? 0) }
    })
    const last = months.length - 1

    return {
      subtitle: monthsSubtitle(months),
      summary:
        `Patrimoine en ${series.map((serie) => serie.code).join(', ')} entre ${formatMonthKey(months[0].key)} et ${formatMonthKey(months[last].key)} : ` +
        series.map((serie) => money(serie.values[last], serie.code)).join(', ') +
        ' au dernier mois.',
      option: currencyOption(months, series),
      height: 360,
      table: {
        columns: ['Mois', ...series.map((serie) => serie.code)],
        numeric: [false, ...series.map(() => true)],
        rows: [...months]
          .map((month, m) => [formatMonthKey(month.key), ...series.map((serie) => money(serie.values[m], serie.code))])
          .reverse(),
      },
      note: [
        found.length < CURRENCIES.length ? `Colonnes trouvées : ${found.map((currency) => currency.column).join(', ')}.` : '',
        skippedNote(months.skipped),
      ]
        .filter(Boolean)
        .join(' '),
    }
  },
}
