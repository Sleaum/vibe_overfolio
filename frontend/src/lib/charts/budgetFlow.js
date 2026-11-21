// 6. Flux du budget : table `budget`, colonnes Source, Destination, Valeur, en diagramme de flux (Sankey).

import { buildFlow, requireColumns, rowsOf } from '../aggregate.js'
import { baseOption, tooltipBox, tooltipHtml } from '../chartTheme.js'
import { euro, formatDateTime } from '../format.js'
import { FONT, INK, SERIES, SURFACE } from '../palette.js'

export function sankeyOption(nodes, links) {
  return {
    ...baseOption(),
    tooltip: tooltipBox({
      trigger: 'item',
      formatter: (p) => {
        if (p.dataType === 'edge') {
          return tooltipHtml(`${p.data.source} → ${p.data.target}`, [
            { color: SERIES[0], label: 'Montant', value: euro(p.data.value), strong: true },
          ])
        }
        return tooltipHtml(p.name, [{ color: SERIES[0], label: 'Total des flux', value: euro(p.value), strong: true }])
      },
    }),
    series: [
      {
        type: 'sankey',
        left: 8,
        right: 130, // place pour les noms de la dernière colonne
        top: 8,
        bottom: 8,
        nodeWidth: 14,
        nodeGap: 14,
        nodeAlign: 'justify',
        draggable: false,
        emphasis: { focus: 'adjacency' },
        data: nodes.map((name) => ({ name, itemStyle: { color: SERIES[0], borderColor: SURFACE, borderWidth: 1 } })),
        links,
        lineStyle: { color: 'source', opacity: 0.25, curveness: 0.5 },
        label: { color: INK, fontSize: 13, fontFamily: FONT },
      },
    ],
  }
}

export default {
  slug: 'flux-budget',
  title: 'Flux du budget',
  summary: 'D’où vient l’argent et où il va.',
  table: 'budget',
  minWidth: 560,
  explain: [
    'Chaque bande relie une source à une destination. Son épaisseur est le montant. Les blocs sont les sources, les étapes intermédiaires et les destinations.',
    'Passe la souris sur un bloc ou sur une bande pour mettre en avant les flux qui y passent et lire leur montant.',
  ],
  source: 'Table budget, colonnes Source, Destination et Valeur (lignes supérieures à 0, doublons additionnés).',

  build(table) {
    const cols = requireColumns(table, {
      source: ['Source'],
      target: ['Destination'],
      value: ['Valeur', 'Value', 'Montant'],
    })
    const { nodes, links, dropped } = buildFlow(rowsOf(table), cols.source, cols.target, cols.value)
    if (!links.length) {
      return { empty: 'Aucun flux supérieur à 0 dans la table budget.' }
    }

    // Total entrant : somme des flux qui partent d'un bloc sans flux entrant
    const targets = new Set(links.map((link) => link.target))
    const entering = links.filter((link) => !targets.has(link.source)).reduce((sum, link) => sum + link.value, 0)

    return {
      subtitle: table.synced_at ? `Synchronisé le ${formatDateTime(table.synced_at)}.` : '',
      summary: `Diagramme de flux : ${links.length} flux entre ${nodes.length} blocs, pour ${euro(entering)} au départ.`,
      option: sankeyOption(nodes, links),
      height: Math.max(360, nodes.length * 30),
      note: dropped
        ? `${dropped} flux ${dropped > 1 ? 'ont été ignorés' : 'a été ignoré'} : ${dropped > 1 ? 'ils fermaient' : 'il fermait'} une boucle (A vers B puis B vers A), ce qu’un diagramme de flux ne peut pas dessiner.`
        : '',
      table: {
        columns: ['Source', 'Destination', 'Montant'],
        numeric: [false, false, true],
        rows: [...links].sort((a, b) => b.value - a.value).map((link) => [link.source, link.target, euro(link.value)]),
      },
    }
  },
}
