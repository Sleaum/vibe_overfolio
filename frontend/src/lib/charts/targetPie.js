// Camembert de la page Models > Target : ta répartition d'aujourd'hui, ou ta cible. Même style que celui de Classic
// (lib/charts/modelPie.js) : nom court sur chaque part, infobulle du site au survol (nom, part, montant).

import { baseOption, tooltipBox, tooltipHtml } from '../chartTheme.js'
import { formatAmount, formatDecimal } from '../format.js'
import { FONT, INK, INK_2, SURFACE } from '../palette.js'
import { t } from '../../i18n/index.js'

/**
 * `slices` : [{ name, short, value (en %), amount (facultatif), color }] ; les parts nulles sont ignorées.
 * `title` : texte au centre-haut (« Aujourd'hui », « Cible 2040 »).
 */
export function targetPieOption(slices, title) {
  return {
    ...baseOption(),
    title: { text: title, left: 'center', top: 0, textStyle: { color: INK, fontSize: 13, fontWeight: 600, fontFamily: FONT } },
    tooltip: tooltipBox({
      trigger: 'item',
      formatter: (p) =>
        tooltipHtml(p.name, [
          { color: p.color, label: t('targetPage.share'), value: `${formatDecimal(p.value)} %`, strong: true },
          ...(p.data.amount != null ? [{ label: t('targetPage.amount'), value: formatAmount(p.data.amount) }] : []),
        ]),
    }),
    series: [
      {
        type: 'pie',
        radius: '58%',
        center: ['50%', '55%'],
        startAngle: 90,
        avoidLabelOverlap: true,
        minShowLabelAngle: 6,
        label: {
          show: true,
          position: 'outside',
          formatter: (p) => p.data.short,
          color: INK,
          fontFamily: FONT,
          fontSize: 11,
          lineHeight: 13,
          width: 80,
          overflow: 'break',
        },
        labelLine: { show: true, length: 6, length2: 8, lineStyle: { color: INK_2 } },
        labelLayout: { hideOverlap: true },
        itemStyle: { borderColor: SURFACE, borderWidth: 1.5 },
        emphasis: { scale: true, scaleSize: 4 },
        data: slices
          .filter((s) => s.value > 0)
          .map((s) => ({ name: s.name, value: Math.round(s.value * 10) / 10, short: s.short, amount: s.amount, itemStyle: { color: s.color } })),
      },
    ],
  }
}
