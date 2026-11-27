// Portfolio Flow 1 : patrimoine exprimé dans les devises choisies (EUR, USD, CHF, THB), un groupe de barres par mois.
// Table `history` : une colonne de montants par devise (par exemple « EUR » ou « Assets CHF »).
// Devises affichées : celles cochées au-dessus du graphique (lib/currencies.js, gardées sur le profil).

import { DataError, requireColumns, rowsOf } from '../aggregate.js'
import { baseOption, categoryAxis, legendTop, tooltipBox, tooltipHtml, valueAxis, zoomSlider } from '../chartTheme.js'
import { formatMonthKey, formatMonthKeyTiny } from '../format.js'
import { HOVER_SHADE, blues } from '../palette.js'
import { availableCurrencies, selectedCurrencies } from '../currencies.js'
import { compactNumber, money, monthEnds, monthsSubtitle, skippedNote, totalsByDate } from './flowData.js'
import { t, tList } from '../../i18n/index.js'


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
  amounts: true, // suit le bouton Brut / Net (lib/amounts.js)
  get title() {
    return t('charts.currency.title')
  },
  get summary() {
    return t('charts.currency.summary')
  },
  table: 'history',
  projection: true, // + le mois prochain, tiré de portfolio (wealth/projection.py)
  minWidth: 720,
  get explain() {
    return tList('charts.currency.explain')
  },
  get source() {
    return t('charts.currency.source')
  },

  build(table) {
    const cols = requireColumns(table, { date: ['Date'] })
    const { shown: available, more } = availableCurrencies(table)

    if (!available.length) {
      throw new DataError(
        t('charts.currency.noColumn', {
          table: table?.name ?? 'history',
          available: (table?.columns ?? []).join(', ') || t('data.none'),
        }),
      )
    }

    const rows = rowsOf(table)
    const months = monthEnds(rows, cols.date)
    if (!months.length) return { empty: t('errors.noDates', { table: 'history' }) }

    // Devises cochées, une nuance de bleu chacune (de la plus foncée à la plus claire)
    const codes = selectedCurrencies(available)
    const shades = blues(codes.length)
    const found = available.filter((item) => codes.includes(item.code))
    const series = found.map((currency, index) => {
      const totals = totalsByDate(rows, cols.date, currency.column)
      return { ...currency, color: shades[index], values: months.map((month) => totals.get(month.iso) ?? 0) }
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
      // Choix des devises, affiché au-dessus du graphique (CurrencyPicker.vue)
      currencies: { available: available.map((item) => item.code), selected: codes, more },
      height: 360,
      table: {
        columns: [t('chart.month'), ...series.map((serie) => serie.code)],
        numeric: [false, ...series.map(() => true)],
        rows: [...months]
          .map((month, m) => [formatMonthKey(month.key), ...series.map((serie) => money(serie.values[m], serie.code))])
          .reverse(),
      },
      note: [
        t('charts.currency.columnsFound', { columns: found.map((currency) => currency.column).join(', ') }),
        skippedNote(months.skipped),
      ]
        .filter(Boolean)
        .join(' '),
    }
  },
}
