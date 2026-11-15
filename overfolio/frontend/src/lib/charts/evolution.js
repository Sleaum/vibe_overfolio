// 1. Évolution du patrimoine : table `_history`, une ligne par date.

import { buildEvolution, findColumn, requireColumns, rowsOf } from '../aggregate.js'
import { baseOption, legendTop, tooltipBox, tooltipHtml, valueAxis, zoomSlider, axisLabelStyle } from '../chartTheme.js'
import {
  axisEuroFormatter,
  euro,
  formatDateLong,
  formatDateNumeric,
  formatDateShort,
  formatDayMonth,
  formatMonthYear,
  plural,
} from '../format.js'
import { AXIS, CONTEXT, FONT, INK, SERIES, SURFACE } from '../palette.js'

const DAY = 86_400_000

/**
 * Option ECharts de la courbe. `preview` : version allégée pour la page de présentation
 * (une seule courbe, pas de légende, pas de curseur de zoom).
 */
export function evolutionOption(points, { preview = false } = {}) {
  const first = points[0]
  const last = points[points.length - 1]
  const spanDays = (last.ts - first.ts) / DAY
  const yMax = Math.max(...points.map((p) => Math.max(p.assets, p.net)))
  const byTimestamp = new Map(points.map((p) => [p.ts, p]))
  const zoom = !preview && points.length > 24

  const line = (name, color, data, extra = {}) => ({
    name,
    type: 'line',
    data,
    showSymbol: false,
    symbol: 'circle',
    symbolSize: 8,
    lineStyle: { width: 2, color },
    itemStyle: { color, borderColor: SURFACE, borderWidth: 2 },
    ...extra,
  })

  const net = line('Patrimoine net', SERIES[0], points.map((p) => [p.ts, Math.round(p.net)]), {
    areaStyle: { color: SERIES[0], opacity: 0.1 },
    z: 3,
  })
  const assets = line('Actifs', CONTEXT, points.map((p) => [p.ts, Math.round(p.assets)]), { z: 2 })

  // Dernier point : pastille avec anneau blanc, et sa valeur écrite à droite (sauf dans l'aperçu)
  const endPoint = {
    name: 'Dernier point',
    type: 'scatter',
    data: [[last.ts, Math.round(last.net)]],
    symbolSize: 10,
    silent: true,
    z: 4,
    itemStyle: { color: SERIES[0], borderColor: SURFACE, borderWidth: 2 },
    label: {
      show: !preview,
      position: 'right',
      distance: 10,
      formatter: () => euro(last.net),
      color: INK,
      fontSize: 12,
      fontWeight: 600,
      fontFamily: FONT,
    },
  }

  return {
    ...baseOption(),
    animationDuration: preview ? 1400 : 700,
    grid: {
      left: 4,
      right: preview ? 20 : 92,
      top: preview ? 12 : 40,
      bottom: zoom ? 44 : 8,
      containLabel: true,
    },
    legend: preview ? undefined : legendTop(['Patrimoine net', 'Actifs'], { line: true }),
    tooltip: tooltipBox({
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: AXIS, width: 1, type: 'solid' } },
      formatter: (params) => {
        const lines = [].concat(params).filter((p) => p.seriesType === 'line')
        if (!lines.length) return ''
        const ts = lines[0].value[0]
        const point = byTimestamp.get(ts)
        if (!point) return ''
        const rows = [{ color: SERIES[0], label: 'Patrimoine net', value: euro(point.net), strong: true }]
        if (!preview) {
          rows.push(
            { color: CONTEXT, label: 'Actifs', value: euro(point.assets) },
            { label: 'Dettes', value: euro(point.liabilities) },
          )
        }
        return tooltipHtml(formatDateLong(ts), rows)
      },
    }),
    xAxis: {
      type: 'time',
      axisTick: { show: false },
      axisLine: { lineStyle: { color: AXIS } },
      splitLine: { show: false },
      axisLabel: {
        ...axisLabelStyle,
        hideOverlap: true,
        formatter: (value) => (spanDays > 400 ? formatMonthYear(value) : formatDayMonth(value)),
      },
    },
    yAxis: valueAxis(axisEuroFormatter(yMax), preview ? { splitNumber: 3 } : {}),
    dataZoom: zoom ? [zoomSlider()] : undefined,
    series: preview ? [net, endPoint] : [assets, net, endPoint],
  }
}

export default {
  slug: 'evolution-patrimoine',
  title: 'Évolution du patrimoine',
  summary: 'Ton patrimoine net, date après date.',
  group: 'evolution',
  thumb: 'line',
  table: '_history',
  explain: [
    'Chaque point de la courbe bleue est le total de tes actifs à une date, moins tes dettes : c’est ton patrimoine net. La courbe grise montre les actifs seuls.',
    'L’écart entre les deux courbes correspond à tes dettes. Passe la souris sur la courbe (ou touche-la) pour lire les montants d’une date.',
  ],
  source:
    'Table _history, colonnes Date, Assets Master Currency et Liabilities Master Currency, additionnées par date. Patrimoine net = actifs + dettes (les dettes sont négatives).',

  build(table) {
    const cols = requireColumns(table, { date: ['Date'], assets: ['Assets Master Currency'] })
    const liabilities = findColumn(table.columns, ['Liabilities Master Currency'])
    const points = buildEvolution(rowsOf(table), cols.date, cols.assets, liabilities)

    if (points.length < 2) {
      return { empty: 'Il faut au moins deux dates dans la table _history pour tracer une courbe.' }
    }

    const first = points[0]
    const last = points[points.length - 1]
    return {
      subtitle: `Données au ${formatDateLong(last.date)}, ${plural(points.length, 'relevé')} depuis le ${formatDateShort(first.date)}.`,
      summary: `Courbe du patrimoine net : ${euro(first.net)} le ${formatDateShort(first.date)}, ${euro(last.net)} le ${formatDateShort(last.date)}.`,
      option: evolutionOption(points),
      height: 400,
      table: {
        columns: ['Date', 'Patrimoine net', 'Actifs', 'Dettes'],
        numeric: [false, true, true, true],
        rows: [...points]
          .reverse()
          .map((p) => [formatDateNumeric(p.date), euro(p.net), euro(p.assets), euro(p.liabilities)]),
      },
      note: liabilities
        ? ''
        : 'La colonne « Liabilities Master Currency » est absente de la table : le patrimoine net est égal aux actifs.',
    }
  },
}
