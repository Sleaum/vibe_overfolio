// 2. Répartition par type d'actif : table `portfolio`, colonne Asset, montants « Assets Master Currency » > 0.
// L'anneau suit l'ordre fixe des couleurs (jamais l'ordre de taille) pour que chaque type garde sa place et sa
// couleur d'une synchronisation à l'autre ; la liste à côté donne les montants, du plus gros au plus petit.

import { requireColumns, rowsOf, splitBy } from '../aggregate.js'
import { baseOption, tooltipBox, tooltipHtml } from '../chartTheme.js'
import { capitalize, euro, percent } from '../format.js'
import { CONTEXT, FONT, INK, INK_2, SURFACE, assignAssetColors } from '../palette.js'
import { dataSubtitle } from './common.js'

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
    parts.push({ name: 'Autres', value: othersValue, share: othersValue / total, color: CONTEXT, slot: 99 })
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
          { color: p.color, label: 'Montant', value: euro(p.value), strong: true },
          { label: 'Part du total', value: percent(p.value / total) },
        ]),
    }),
    title: {
      text: euro(total),
      subtext: 'Total des actifs',
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

export default {
  slug: 'repartition-actifs',
  title: 'Répartition par type d’actif',
  summary: 'Ce que pèse chaque type d’actif dans ton patrimoine.',
  group: 'repartition',
  thumb: 'donut',
  table: 'portfolio',
  explain: [
    'Chaque part de l’anneau est un type d’actif (actions, immobilier, liquidités, crypto…). Sa taille est son poids dans le total de tes actifs. Les dettes ne sont pas comptées ici.',
    'La liste à côté donne les montants exacts et les parts, du plus gros au plus petit. Chaque type garde la même couleur d’un graphique à l’autre.',
  ],
  source: 'Table portfolio, colonnes Asset et Assets Master Currency (lignes supérieures à 0).',

  build(table) {
    const cols = requireColumns(table, { asset: ['Asset'], value: ['Assets Master Currency'] })
    const { entries, total } = splitBy(rowsOf(table), cols.asset, cols.value)
    if (!entries.length) {
      return { empty: 'Aucun montant supérieur à 0 dans la table portfolio.' }
    }

    const parts = assetParts(entries, total)
    const byValue = [...parts].sort((a, b) => b.value - a.value)
    const biggest = byValue[0]

    return {
      subtitle: dataSubtitle(table, 'Positions au'),
      summary: `Anneau de ${parts.length} types d’actifs pour ${euro(total)} au total. Le plus gros : ${biggest.name}, ${percent(biggest.share)}.`,
      option: donutOption(parts, total),
      height: 320,
      legend: byValue.map((part) => ({
        name: part.name,
        color: part.color,
        amount: euro(part.value),
        share: percent(part.share),
      })),
      table: {
        columns: ['Type d’actif', 'Montant', 'Part'],
        numeric: [false, true, true],
        rows: [
          ...byValue.map((part) => [part.name, euro(part.value), percent(part.share)]),
          ['Total', euro(total), percent(1)],
        ],
      },
    }
  },
}
