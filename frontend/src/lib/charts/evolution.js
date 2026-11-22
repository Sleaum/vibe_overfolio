// Courbe du patrimoine net : utilisée par l'aperçu de la page d'accueil (components/landing/HeroPreview.vue).
// Ce n'est plus un graphique de la page /graphiques ; la fonction garde les deux modes (aperçu et version complète).

import { baseOption, legendTop, tooltipBox, tooltipHtml, valueAxis, zoomSlider, axisLabelStyle } from '../chartTheme.js'
import { axisEuroFormatter, euro, formatDateLong, formatDayMonth, formatMonthYear } from '../format.js'
import { AXIS, CONTEXT, FONT, INK, SERIES, SURFACE } from '../palette.js'
import { t } from '../../i18n/index.js'

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

  const net = line(t('chart.netWorth'), SERIES[0], points.map((p) => [p.ts, Math.round(p.net)]), {
    areaStyle: { color: SERIES[0], opacity: 0.1 },
    z: 3,
  })
  const assets = line(t('chart.assets'), CONTEXT, points.map((p) => [p.ts, Math.round(p.assets)]), { z: 2 })

  // Dernier point : pastille avec anneau blanc, et sa valeur écrite à droite (sauf dans l'aperçu)
  const endPoint = {
    name: t('chart.lastPoint'),
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
    legend: preview ? undefined : legendTop([t('chart.netWorth'), t('chart.assets')], { line: true }),
    tooltip: tooltipBox({
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: AXIS, width: 1, type: 'solid' } },
      formatter: (params) => {
        const lines = [].concat(params).filter((p) => p.seriesType === 'line')
        if (!lines.length) return ''
        const ts = lines[0].value[0]
        const point = byTimestamp.get(ts)
        if (!point) return ''
        const rows = [{ color: SERIES[0], label: t('chart.netWorth'), value: euro(point.net), strong: true }]
        if (!preview) {
          rows.push(
            { color: CONTEXT, label: t('chart.assets'), value: euro(point.assets) },
            { label: t('chart.liabilities'), value: euro(point.liabilities) },
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
