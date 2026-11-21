// Graphique en éventail de la page Simulation : médiane, fourchette 25-75 % et fourchette 10-90 % du patrimoine net,
// année par année, avec l'objectif en losange.

import { axisLabelStyle, baseOption, legendTop, tooltipBox, tooltipHtml, valueAxis } from '../chartTheme.js'
import { axisEuroFormatter, euro } from '../format.js'
import { AXIS, SERIES } from '../palette.js'

const BLUE = SERIES[0]
const OUTER = 'rgba(42, 120, 214, 0.14)'
const INNER = 'rgba(42, 120, 214, 0.30)'
const LEGEND = { [OUTER]: 'rgba(42, 120, 214, 0.3)', [INNER]: 'rgba(42, 120, 214, 0.6)' }

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
    legend: legendTop(['Médiane', 'Fourchette 25-75 %', 'Fourchette 10-90 %', ...(goal ? ['Objectif'] : [])]),
    tooltip: tooltipBox({
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: AXIS, width: 1 } },
      formatter: (params) => {
        const index = [].concat(params)[0]?.dataIndex
        const point = points[index]
        if (!point) return ''
        const [p10, p25, p50, p75, p90] = point.values
        const rows = [
          { label: 'Scénario favorable (90 %)', value: euro(p90) },
          { label: 'Plutôt favorable (75 %)', value: euro(p75) },
          { color: BLUE, label: 'Médiane', value: euro(p50), strong: true },
          { label: 'Plutôt défavorable (25 %)', value: euro(p25) },
          { label: 'Scénario défavorable (10 %)', value: euro(p10) },
        ]
        if (goal && goal.label === point.label) rows.push({ color: SERIES[1], label: 'Objectif', value: euro(goal.amount), strong: true })
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
      band('Fourchette 10-90 %', diff(0, 1), OUTER),
      band('Fourchette 25-75 %', diff(1, 2), INNER),
      band('Fourchette 25-75 %', diff(2, 3), INNER),
      band('Fourchette 10-90 %', diff(3, 4), OUTER),
      {
        name: 'Médiane',
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
              name: 'Objectif',
              type: 'scatter',
              data: labels.map((label) => (label === goal.label ? goal.amount : null)),
              symbol: 'diamond',
              symbolSize: 14,
              itemStyle: { color: SERIES[1] },
              z: 6,
            },
          ]
        : []),
    ],
  }
}
