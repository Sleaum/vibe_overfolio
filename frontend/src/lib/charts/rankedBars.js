// Barres horizontales classées : zones géographiques et plus grosses positions.
// Une seule série = une seule couleur (la première de la palette), valeur écrite au bout de chaque barre,
// donc pas de légende ni d'axe des valeurs.

import { axisLabelStyle, baseOption, categoryAxis, tooltipBox, tooltipHtml } from '../chartTheme.js'
import { euro, percent } from '../format.js'
import { AXIS, FONT, INK, SERIES } from '../palette.js'

/**
 * entries : [{ name, value }] du plus grand au plus petit ; total : somme de référence pour les parts.
 */
export function rankedBarsOption(entries, total, { valueLabel = 'Montant' } = {}) {
  return {
    ...baseOption(),
    grid: { left: 4, right: 100, top: 8, bottom: 8, containLabel: true },
    tooltip: tooltipBox({
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(31, 35, 40, 0.04)' } },
      formatter: (params) => {
        const first = [].concat(params)[0]
        const entry = entries[first?.dataIndex]
        if (!entry) return ''
        return tooltipHtml(entry.name, [
          { color: SERIES[0], label: valueLabel, value: euro(entry.value), strong: true },
          { label: 'Part du total', value: percent(entry.value / total) },
        ])
      },
    }),
    xAxis: { type: 'value', show: false },
    yAxis: categoryAxis(
      entries.map((entry) => entry.name),
      {
        inverse: true,
        axisLine: { lineStyle: { color: AXIS } },
        axisLabel: { ...axisLabelStyle, color: INK, width: 150, overflow: 'truncate', hideOverlap: false },
      },
    ),
    series: [
      {
        type: 'bar',
        data: entries.map((entry) => entry.value),
        barMaxWidth: 20,
        barCategoryGap: '45%',
        itemStyle: { color: SERIES[0], borderRadius: [0, 4, 4, 0] },
        label: {
          show: true,
          position: 'right',
          distance: 8,
          formatter: (p) => euro(p.value),
          color: INK,
          fontSize: 12,
          fontWeight: 600,
          fontFamily: FONT,
        },
      },
    ],
  }
}

/** Hauteur du graphique selon le nombre de barres. */
export const rankedBarsHeight = (count) => Math.max(200, count * 40 + 24)
