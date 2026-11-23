// Barres horizontales empilées : une barre par groupe (enveloppe, compte…), découpée en séries de couleur,
// avec le total écrit au bout. `groups` : [{ name, total }] ; `series` : [{ label, color }] ; `values[g][s]` : montants.

import { axisLabelStyle, baseOption, categoryAxis, legendTop, tooltipBox, tooltipHtml } from '../chartTheme.js'
import { formatAmount, percent } from '../format.js'
import { AXIS, FONT, HOVER_SHADE, INK, SURFACE } from '../palette.js'
import { t } from '../../i18n/index.js'

const TOTAL = () => t('chart.total')

export function stackedOption(groups, series, values) {
  // Dernier segment non nul de chaque barre : c'est lui qui a le bout arrondi
  const lastIndex = values.map((row) => row.reduce((last, value, index) => (value > 0 ? index : last), -1))

  return {
    ...baseOption(),
    grid: { left: 4, right: 110, top: 44, bottom: 8, containLabel: true },
    legend: legendTop(series.map((serie) => serie.label)),
    tooltip: tooltipBox({
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: HOVER_SHADE } },
      formatter: (params) => {
        const first = [].concat(params)[0]
        const index = first?.dataIndex
        const group = groups[index]
        if (!group) return ''
        const rows = series
          .map((serie, s) => ({ serie, value: values[index][s] }))
          .filter((item) => item.value > 0)
          .map((item) => ({
            color: item.serie.color,
            label: item.serie.label,
            value: `${formatAmount(item.value)} (${percent(item.value / group.total)})`,
          }))
        rows.push({ label: TOTAL(), value: formatAmount(group.total), strong: true })
        return tooltipHtml(group.name, rows)
      },
    }),
    xAxis: { type: 'value', show: false },
    yAxis: categoryAxis(
      groups.map((group) => group.name),
      {
        inverse: true,
        axisLine: { lineStyle: { color: AXIS } },
        axisLabel: { ...axisLabelStyle, color: INK, width: 150, overflow: 'truncate', hideOverlap: false },
      },
    ),
    series: [
      ...series.map((serie, s) => ({
        name: serie.label,
        type: 'bar',
        stack: 'total',
        barMaxWidth: 22,
        barCategoryGap: '45%',
        // Écart de 2 px entre segments : un filet de la couleur du fond, pas une bordure de couleur
        itemStyle: { color: serie.color, borderColor: SURFACE, borderWidth: 2 },
        data: groups.map((_, g) => {
          const value = values[g][s]
          if (!(value > 0)) return null
          return lastIndex[g] === s ? { value, itemStyle: { borderRadius: [0, 4, 4, 0] } } : value
        }),
      })),
      {
        // Série invisible de longueur 0 : elle porte seulement le total, écrit au bout de chaque barre
        name: TOTAL(),
        type: 'bar',
        stack: 'total',
        silent: true,
        legendHoverLink: false,
        data: groups.map(() => 0),
        itemStyle: { color: 'transparent' },
        label: {
          show: true,
          position: 'right',
          distance: 8,
          formatter: (p) => formatAmount(groups[p.dataIndex].total),
          color: INK,
          fontSize: 12,
          fontWeight: 600,
          fontFamily: FONT,
        },
      },
    ],
  }
}
