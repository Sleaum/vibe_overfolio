// Anneau des types d'actifs, utilisé par la page Portfolio Snapshot (SnapshotPage.vue, lib/snapshot.js).
// L'anneau suit l'ordre fixe des couleurs (jamais l'ordre de taille) pour que chaque type garde sa place et sa
// couleur d'une synchronisation à l'autre ; la liste à côté donne les montants, du plus gros au plus petit.

import { baseOption, tooltipBox, tooltipHtml } from '../chartTheme.js'
import { capitalize, euro, percent } from '../format.js'
import { CONTEXT, FONT, INK, INK_2, SURFACE, assignAssetColors } from '../palette.js'
import { t } from '../../i18n/index.js'

/** Regroupe les types sans couleur libre en « Autres » et prépare les parts. */
export function assetParts(entries, total) {
  const { colors, overflow } = assignAssetColors(entries.map((entry) => entry.name))
  const folded = new Set(overflow)

  const parts = entries
    .filter((entry) => !folded.has(entry.name))
    .map((entry) => ({
      name: capitalize(entry.name),
      value: entry.value,
      share: entry.value / total,
      color: colors.get(entry.name).color,
      slot: colors.get(entry.name).slot,
    }))

  const othersValue = entries
    .filter((entry) => folded.has(entry.name))
    .reduce((sum, entry) => sum + entry.value, 0)
  if (othersValue > 0) {
    parts.push({ name: t('data.others'), value: othersValue, share: othersValue / total, color: CONTEXT, slot: 99 })
  }
  return parts
}

export function donutOption(parts, total) {
  const ring = [...parts].sort((a, b) => a.slot - b.slot)
  return {
    ...baseOption(),
    tooltip: tooltipBox({
      trigger: 'item',
      formatter: (p) =>
        tooltipHtml(p.name, [
          { color: p.color, label: t('chart.amount'), value: euro(p.value), strong: true },
          { label: t('chart.shareOfTotal'), value: percent(p.value / total) },
        ]),
    }),
    title: {
      text: euro(total),
      subtext: t('chart.totalAssets'),
      left: 'center',
      top: 'center',
      itemGap: 4,
      textStyle: { color: INK, fontSize: 22, fontWeight: 700, fontFamily: FONT },
      subtextStyle: { color: INK_2, fontSize: 12, fontFamily: FONT },
    },
    series: [
      {
        type: 'pie',
        radius: ['62%', '88%'],
        center: ['50%', '50%'],
        startAngle: 90,
        avoidLabelOverlap: false,
        label: { show: false },
        labelLine: { show: false },
        // L'écart de 2 px entre les parts est un filet de la couleur du fond
        itemStyle: { borderColor: SURFACE, borderWidth: 2, borderRadius: 4 },
        emphasis: { scale: true, scaleSize: 4 },
        data: ring.map((part) => ({
          name: part.name,
          value: part.value,
          itemStyle: { color: part.color },
        })),
      },
    ],
  }
}
