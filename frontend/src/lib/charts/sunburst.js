// Anneaux à deux niveaux (sunburst) de la page Stratégie.
// Anneau intérieur : les catégories, chacune dans sa couleur fixe. Anneau extérieur : leur détail, en nuances de la même
// couleur. Pas d'étiquettes sur l'anneau (elles se chevauchent) : la légende, l'infobulle et le tableau donnent les noms.
// `categories` vient de lib/strategy.js : [{ name, value, share, color, children: [{ name, value, share, color }] }].

import { baseOption, tooltipBox, tooltipHtml } from '../chartTheme.js'
import { euro, percent } from '../format.js'
import { SURFACE } from '../palette.js'
import { t } from '../../i18n/index.js'

// Un filet de 2 px de la couleur du fond sépare les parts
const ring = (r0, r) => ({
  r0,
  r,
  itemStyle: { borderColor: SURFACE, borderWidth: 2 },
  label: { show: false },
})

export function sunburstOption(categories, total) {
  const twoRings = categories.some((category) => category.children.length > 0)

  const data = categories.map((category) => {
    const node = { name: category.name, itemStyle: { color: category.color }, amount: category.value }
    if (!category.children.length) return { ...node, value: category.value }
    return {
      ...node,
      children: category.children.map((child) => ({
        name: child.name,
        value: child.value,
        itemStyle: { color: child.color },
        amount: child.value,
        parent: category.name,
        parentAmount: category.value,
      })),
    }
  })

  return {
    ...baseOption(),
    tooltip: tooltipBox({
      trigger: 'item',
      // Les noms viennent de la feuille : tooltipHtml les échappe
      formatter: (p) => {
        const item = p?.data ?? {}
        const color = item.itemStyle?.color
        const amount = Number.isFinite(item.amount) ? item.amount : Number(p?.value) || 0
        const rows = [
          { color, label: t('chart.amount'), value: euro(amount), strong: true },
          { label: t('chart.shareOfTotal'), value: percent(amount / total) },
        ]
        if (item.parent) {
          rows.push({ label: t('chart.shareOf', { parent: item.parent }), value: percent(amount / item.parentAmount) })
          return tooltipHtml(`${item.parent} › ${p.name}`, rows)
        }
        return tooltipHtml(p?.name, rows)
      },
    }),
    series: [
      {
        type: 'sunburst',
        data,
        center: ['50%', '50%'],
        radius: [0, '100%'],
        startAngle: 90,
        sort: null, // garde l'ordre voulu : plus grosses parts d'abord, « Autres » puis « Non renseigné » à la fin
        nodeClick: false, // pas de zoom au clic : l'anneau reste lisible d'un coup d'œil
        // Premier niveau `{}` : le centre ; la taille des anneaux est un pourcentage du rayon disponible
        levels: twoRings ? [{}, ring('22%', '58%'), ring('60%', '96%')] : [{}, ring('30%', '96%')],
        itemStyle: { borderColor: SURFACE, borderWidth: 2 },
        label: { show: false },
        emphasis: { focus: 'ancestor' },
      },
    ],
  }
}
