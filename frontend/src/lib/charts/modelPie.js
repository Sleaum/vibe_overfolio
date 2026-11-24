// Camembert d'un portefeuille modèle (page Models, colonne Répartition et cartes) : ECharts, comme les autres graphiques.
// Chaque part porte le nom court de sa classe d'actifs (modelsPage.short) ; au survol, l'infobulle du site donne tout :
// nom complet, part, famille et enveloppe où la loger en France (rubrique modelsPage.france.bricks).
// Couleurs : celles des types d'actifs (lib/models.js, modelColors) ; passage en sombre par BaseChart.vue.

import { baseOption, tooltipBox, tooltipHtml } from '../chartTheme.js'
import { formatDecimal } from '../format.js'
import { CLASSES, brickOf } from '../models.js'
import { FONT, INK, INK_2, SURFACE } from '../palette.js'
import { t } from '../../i18n/index.js'

/**
 * `model` : entrée de MODELS ; `classColors` : { classe: couleur } (modelColors().classes).
 * Les parts gardent l'ordre de la répartition du modèle, en partant du haut, dans le sens des aiguilles d'une montre.
 */
export function modelPieOption(model, classColors) {
  const data = model.allocation.map(([cls, value, label]) => ({
    name: t(label ? `modelsPage.slices.${label}` : `modelsPage.classes.${cls}`),
    value,
    cls,
    short: t(`modelsPage.short.${cls}`),
    itemStyle: { color: classColors[cls] },
  }))
  return {
    ...baseOption(),
    tooltip: tooltipBox({
      trigger: 'item',
      confine: false,
      appendTo: 'body', // la cellule du tableau est trop petite pour contenir l'infobulle
      formatter: (p) =>
        tooltipHtml(p.name, [
          { color: p.color, label: t('modelsPage.pie.share'), value: `${formatDecimal(p.value)} %`, strong: true },
          { label: t('modelsPage.pie.family'), value: t(`modelsPage.families.${CLASSES[p.data.cls].family}`) },
          { label: t('modelsPage.pie.where'), value: t(`modelsPage.france.bricks.${brickOf(p.data.cls)}.where`) },
        ]),
    }),
    series: [
      {
        type: 'pie',
        radius: '50%',
        center: ['50%', '50%'],
        startAngle: 90,
        clockwise: true,
        avoidLabelOverlap: true,
        minShowLabelAngle: 8,
        label: {
          show: true,
          position: 'outside',
          formatter: (p) => p.data.short,
          color: INK,
          fontFamily: FONT,
          fontSize: 11,
          lineHeight: 13,
          width: 56,
          overflow: 'break',
        },
        labelLine: { show: true, length: 5, length2: 6, lineStyle: { color: INK_2 } },
        labelLayout: { hideOverlap: true },
        // L'écart entre les parts est un filet de la couleur du fond
        itemStyle: { borderColor: SURFACE, borderWidth: 1.5 },
        emphasis: { scale: true, scaleSize: 4 },
        data,
      },
    ],
  }
}
