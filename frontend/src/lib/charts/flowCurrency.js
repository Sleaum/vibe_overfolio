// Portfolio Flow 1 : patrimoine exprimé en CHF, EUR et USD, un groupe de barres par mois.
// Table `_history` : une colonne de montants par devise (par exemple « EUR »).
// Montant BRUT, comme les autres graphiques (Assets Master Currency) : dans la feuille, les colonnes de devise
// portent aussi les dettes, en négatif. Une ligne de dette (Liabilities Master Currency renseignée) ou un montant
// négatif n'est donc pas compté.

import { DataError, findColumn, requireColumns, rowsOf, toNumber } from '../aggregate.js'
import { baseOption, categoryAxis, legendTop, tooltipBox, tooltipHtml, valueAxis, zoomSlider } from '../chartTheme.js'
import { formatMonthKey, formatMonthKeyTiny } from '../format.js'
import { HOVER_SHADE, SERIES } from '../palette.js'
import { compactNumber, findCurrencyColumn, money, monthEnds, monthsSubtitle, skippedNote, totalsByDate } from './flowData.js'
import { t, tList } from '../../i18n/index.js'

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
      axisPointer: { type: 'shadow', shadowStyle: { color: HOVER_SHADE } },
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
  get title() {
    return t('charts.currency.title')
  },
  get summary() {
    return t('charts.currency.summary')
  },
  table: '_history',
  minWidth: 720,
  get explain() {
    return tList('charts.currency.explain')
  },
  get source() {
    return t('charts.currency.source')
  },

  build(table) {
    const cols = requireColumns(table, { date: ['Date'] })
    const found = CURRENCIES.map((currency) => ({
      ...currency,
      column: findCurrencyColumn(table.columns, currency.code),
    })).filter((currency) => currency.column)

    if (!found.length) {
      throw new DataError(
        t('charts.currency.noColumn', {
          table: table?.name ?? '_history',
          available: (table?.columns ?? []).join(', ') || t('data.none'),
        }),
      )
    }

    // Actifs seulement : ni les lignes de dette, ni les montants négatifs (dettes des relevés sans colonne de dette)
    const liabilities = findColumn(table.columns, ['Liabilities Master Currency'])
    const rows = rowsOf(table).filter((row) => !liabilities || !toNumber(row[liabilities]))
    const months = monthEnds(rows, cols.date)
    if (!months.length) return { empty: t('errors.noDates', { table: '_history' }) }

    const series = found.map((currency) => {
      const assets = rows.filter((row) => toNumber(row[currency.column]) > 0)
      const totals = totalsByDate(assets, cols.date, currency.column)
      return { ...currency, values: months.map((month) => totals.get(month.iso) ?? 0) }
    })
    const last = months.length - 1

    return {
      subtitle: monthsSubtitle(months),
      summary: t('charts.currency.a11y', {
        codes: series.map((serie) => serie.code).join(', '),
        from: formatMonthKey(months[0].key),
        to: formatMonthKey(months[last].key),
        amounts: series.map((serie) => money(serie.values[last], serie.code)).join(', '),
      }),
      option: currencyOption(months, series),
      height: 360,
      table: {
        columns: [t('chart.month'), ...series.map((serie) => serie.code)],
        numeric: [false, ...series.map(() => true)],
        rows: [...months]
          .map((month, m) => [formatMonthKey(month.key), ...series.map((serie) => money(serie.values[m], serie.code))])
          .reverse(),
      },
      note: [
        found.length < CURRENCIES.length
          ? t('charts.currency.columnsFound', { columns: found.map((currency) => currency.column).join(', ') })
          : '',
        skippedNote(months.skipped),
      ]
        .filter(Boolean)
        .join(' '),
    }
  },
}
