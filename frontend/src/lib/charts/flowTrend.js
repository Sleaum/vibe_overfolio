// Portfolio Flow 5 : patrimoine en euros à chaque relevé (barres) et sa tendance (droite des moindres carrés).
// Table `_history` : une colonne « EUR » si elle existe, sinon Assets Master Currency.

import { DataError, findColumn, requireColumns, rowsOf } from '../aggregate.js'
import { axisLabelStyle, baseOption, legendTop, tooltipBox, tooltipHtml, valueAxis, zoomSlider } from '../chartTheme.js'
import { axisEuroFormatter, euro, formatDateLong, formatDateNumeric, formatMonthYear } from '../format.js'
import { AXIS, SERIES } from '../palette.js'
import { isoToTimestamp } from '../dates.js'
import { dataSubtitle } from './common.js'
import { findCurrencyColumn, linearTrend, totalsByDate } from './flowData.js'

const DAY = 86_400_000
const BARS = 'Patrimoine en euros'
const TREND = 'Tendance'

export function trendOption(points, trend) {
  const first = points[0][0]
  const last = points[points.length - 1][0]
  const zoom = points.length > 24
  const max = Math.max(...points.map(([, value]) => value), trend.at(last))
  const byTimestamp = new Map(points)

  return {
    ...baseOption(),
    grid: { left: 4, right: 12, top: 40, bottom: zoom ? 44 : 8, containLabel: true },
    legend: legendTop([BARS, TREND]),
    tooltip: tooltipBox({
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: AXIS, width: 1, type: 'solid' } },
      formatter: (params) => {
        const bar = [].concat(params).find((p) => p.seriesName === BARS)
        if (!bar) return ''
        const ts = bar.value[0]
        return tooltipHtml(formatDateLong(ts), [
          { color: SERIES[0], label: BARS, value: euro(byTimestamp.get(ts)), strong: true },
          { color: SERIES[2], label: TREND, value: euro(trend.at(ts)) },
        ])
      },
    }),
    xAxis: {
      type: 'time',
      axisTick: { show: false },
      axisLine: { lineStyle: { color: AXIS } },
      splitLine: { show: false },
      axisLabel: { ...axisLabelStyle, hideOverlap: true, formatter: (value) => formatMonthYear(value) },
    },
    yAxis: valueAxis(axisEuroFormatter(max)),
    dataZoom: zoom ? [zoomSlider()] : undefined,
    series: [
      {
        name: BARS,
        type: 'bar',
        data: points,
        barMinWidth: 3,
        barMaxWidth: 10,
        itemStyle: { color: SERIES[0], borderRadius: [2, 2, 0, 0] },
      },
      {
        name: TREND,
        type: 'line',
        data: [
          [first, Math.round(trend.at(first))],
          [last, Math.round(trend.at(last))],
        ],
        showSymbol: false,
        silent: true,
        lineStyle: { width: 2, color: SERIES[2] },
        itemStyle: { color: SERIES[2] },
        z: 3,
      },
    ],
  }
}

export default {
  slug: 'patrimoine-tendance',
  title: 'Patrimoine et tendance',
  summary: 'Ton patrimoine en euros à chaque relevé, avec la droite de tendance.',
  table: '_history',
  minWidth: 720,
  explain: [
    'Chaque barre est le total de tes actifs en euros à la date d’un relevé. La droite est la tendance moyenne de tous les relevés : elle montre le rythme de croissance, pas une prévision.',
    'Une date très éloignée dans la feuille (un objectif, une simulation) étire l’axe du temps et aplatit les barres : c’est visible ici, et le curseur du bas permet de zoomer.',
  ],
  source: 'Table _history, colonne Date et colonne de montants en euros (EUR, sinon Assets Master Currency), additionnées par date.',

  build(table) {
    const cols = requireColumns(table, { date: ['Date'] })
    const valueColumn =
      findCurrencyColumn(table.columns, 'EUR') ?? findColumn(table.columns, ['Assets Master Currency'])
    if (!valueColumn) {
      throw new DataError(
        `Colonne de montants en euros introuvable dans la table « ${table?.name ?? '_history'} » : EUR ou Assets Master Currency. ` +
          `Colonnes disponibles : ${(table?.columns ?? []).join(', ') || 'aucune'}.`,
      )
    }

    const totals = totalsByDate(rowsOf(table), cols.date, valueColumn)
    const points = [...totals.entries()]
      .filter(([, value]) => value > 0)
      .map(([iso, value]) => [isoToTimestamp(iso), Math.round(value)])
      .sort((a, b) => a[0] - b[0])
    if (points.length < 2) return { empty: 'Il faut au moins deux relevés dans la table _history pour tracer une tendance.' }

    const { slope, intercept } = linearTrend(points)
    const trend = { at: (ts) => slope * ts + intercept }
    const perYear = slope * DAY * 365.25
    const last = points[points.length - 1]

    return {
      subtitle: dataSubtitle(table, 'Relevés jusqu’au'),
      summary:
        `Patrimoine en euros sur ${points.length} relevés, du ${formatDateLong(points[0][0])} au ${formatDateLong(last[0])}. ` +
        `Dernier relevé : ${euro(last[1])}. La tendance est de ${euro(perYear)} par an.`,
      option: trendOption(points, trend),
      height: 380,
      table: {
        columns: ['Date', 'Patrimoine', 'Tendance'],
        numeric: [false, true, true],
        rows: [...points].reverse().map(([ts, value]) => [formatDateNumeric(ts), euro(value), euro(trend.at(ts))]),
      },
      note: `Colonne utilisée : ${valueColumn}. Tendance : ${euro(perYear)} par an en moyenne.`,
    }
  },
}
