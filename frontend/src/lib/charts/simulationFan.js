// Graphique en éventail de la page Simulation : médiane, fourchette 25-75 % et fourchette 10-90 % du patrimoine net,
// année par année, avec l'objectif en losange.

import { axisLabelStyle, baseOption, legendTop, tooltipBox, tooltipHtml, valueAxis } from '../chartTheme.js'
import { axisEuroFormatter, euro } from '../format.js'
import { AXIS, BLUE, NAVY } from '../palette.js'
import { t } from '../../i18n/index.js'

const OUTER = 'rgba(26, 115, 232, 0.14)' // couleur fixe : bleu des séries
const INNER = 'rgba(26, 115, 232, 0.30)' // couleur fixe : bleu des séries
const LEGEND = { [OUTER]: 'rgba(26, 115, 232, 0.3)', [INNER]: 'rgba(26, 115, 232, 0.6)' } // couleur fixe : bleu des séries

/** points : [{ label, values: [p10, p25, p50, p75, p90] }] ; goal : { label, amount } | null. */
export function fanOption(points, goal) {
  const labels = points.map((point) => point.label)
  const col = (k) => points.map((point) => Math.round(point.values[k]))
  const diff = (a, b) => points.map((point) => Math.max(0, Math.round(point.values[b] - point.values[a])))
  const max = Math.max(...col(4), goal?.amount ?? 0)
  const band = (name, data, color) => ({
    name,
    type: 'line',
    stack: 'fan',
    data,
    symbol: 'none',
    lineStyle: { width: 0 },
    areaStyle: { color, opacity: 1 },
    itemStyle: { color: LEGEND[color] ?? color }, // pastille de légende un peu plus soutenue que la bande
    silent: true,
    tooltip: { show: false },
  })

  return {
    ...baseOption(),
    grid: { left: 4, right: 32, top: 44, bottom: 8, containLabel: true },
    legend: legendTop([t('simulation.median'), t('simulation.range50'), t('simulation.range80'), ...(goal ? [t('simulation.goal')] : [])]),
    tooltip: tooltipBox({
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: AXIS, width: 1 } },
      formatter: (params) => {
        const index = [].concat(params)[0]?.dataIndex
        const point = points[index]
        if (!point) return ''
        const [p10, p25, p50, p75, p90] = point.values
        const rows = [
          { label: t('simulation.p90'), value: euro(p90) },
          { label: t('simulation.p75'), value: euro(p75) },
          { color: BLUE, label: t('simulation.median'), value: euro(p50), strong: true },
          { label: t('simulation.p25'), value: euro(p25) },
          { label: t('simulation.p10'), value: euro(p10) },
        ]
        if (goal && goal.label === point.label) rows.push({ color: NAVY, label: t('simulation.goal'), value: euro(goal.amount), strong: true })
        return tooltipHtml(point.label, rows)
      },
    }),
    xAxis: {
      type: 'category',
      data: labels,
      boundaryGap: false,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: AXIS } },
      axisLabel: { ...axisLabelStyle, hideOverlap: true },
    },
    yAxis: valueAxis(axisEuroFormatter(max)),
    series: [
      { ...band('base', col(0), 'transparent'), legendHoverLink: false },
      band(t('simulation.range80'), diff(0, 1), OUTER),
      band(t('simulation.range50'), diff(1, 2), INNER),
      band(t('simulation.range50'), diff(2, 3), INNER),
      band(t('simulation.range80'), diff(3, 4), OUTER),
      {
        name: t('simulation.median'),
        type: 'line',
        data: col(2),
        symbol: 'circle',
        symbolSize: 6,
        showSymbol: false,
        lineStyle: { width: 2.5, color: BLUE },
        itemStyle: { color: BLUE },
        z: 5,
      },
      ...(goal
        ? [
            {
              name: t('simulation.goal'),
              type: 'scatter',
              data: labels.map((label) => (label === goal.label ? goal.amount : null)),
              symbol: 'diamond',
              symbolSize: 14,
              itemStyle: { color: NAVY },
              z: 6,
            },
          ]
        : []),
    ],
  }
}
