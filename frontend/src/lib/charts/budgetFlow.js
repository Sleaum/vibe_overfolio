// 6. Flux du budget : table `budget`, colonnes Source, Destination, Valeur, en diagramme de flux (Sankey).

import { buildFlow, requireColumns, rowsOf } from '../aggregate.js'
import { baseOption, tooltipBox, tooltipHtml } from '../chartTheme.js'
import { t, tList } from '../../i18n/index.js'
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
            { color: SERIES[0], label: t('chart.amount'), value: euro(p.data.value), strong: true },
          ])
        }
        return tooltipHtml(p.name, [{ color: SERIES[0], label: t('charts.budget.flowTotal'), value: euro(p.value), strong: true }])
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
  get title() {
    return t('charts.budget.title')
  },
  get summary() {
    return t('charts.budget.summary')
  },
  table: 'budget',
  minWidth: 560,
  get explain() {
    return tList('charts.budget.explain')
  },
  get source() {
    return t('charts.budget.source')
  },

  build(table) {
    const cols = requireColumns(table, {
      source: ['Source'],
      target: ['Destination'],
      value: ['Valeur', 'Value', 'Montant'],
    })
    const { nodes, links, dropped } = buildFlow(rowsOf(table), cols.source, cols.target, cols.value)
    if (!links.length) {
      return { empty: t('charts.budget.empty') }
    }

    // Total entrant : somme des flux qui partent d'un bloc sans flux entrant
    const targets = new Set(links.map((link) => link.target))
    const entering = links.filter((link) => !targets.has(link.source)).reduce((sum, link) => sum + link.value, 0)

    return {
      subtitle: table.synced_at ? t('subtitle.syncedAt', { date: formatDateTime(table.synced_at) }) : '',
      summary: t('charts.budget.a11y', { links: links.length, nodes: nodes.length, amount: euro(entering) }),
      option: sankeyOption(nodes, links),
      height: Math.max(360, nodes.length * 30),
      note: dropped ? t('charts.budget.dropped', { count: dropped }, dropped) : '',
      table: {
        columns: tList('charts.budget.columns'),
        numeric: [false, false, true],
        rows: [...links].sort((a, b) => b.value - a.value).map((link) => [link.source, link.target, euro(link.value)]),
      },
    }
  },
}
