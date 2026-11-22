// Anneaux à deux niveaux (sunburst) des pages Strategy et Envelopes.
// Anneau intérieur : les catégories, chacune dans sa couleur fixe. Anneau extérieur : leur détail, en nuances de la même
// couleur. withLabels() écrit les noms sur les parts assez larges pour être lisibles ; les autres se lisent au survol,
// dans la légende et dans le tableau.
// `categories` vient de lib/strategy.js : [{ name, value, share, color, children: [{ name, value, share, color }] }].

import { baseOption, tooltipBox, tooltipHtml } from '../chartTheme.js'
import { euro, percent } from '../format.js'
import { SURFACE } from '../palette.js'
import { t } from '../../i18n/index.js'

// Texte lisible sur une couleur de part : foncé sur une couleur claire (gris « Non renseigné », nuances), blanc sinon
const LIGHT_TEXT = '#fff' // couleur fixe : texte blanc sur couleur de série
const DARK_TEXT = '#1f2937' // couleur fixe : texte foncé sur couleur claire
function textOn(hex) {
  const value = String(hex ?? '').replace('#', '')
  if (value.length !== 6) return LIGHT_TEXT
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.6 ? DARK_TEXT : LIGHT_TEXT
}

/**
 * Écrit les noms sur l'anneau : chaque catégorie à l'intérieur, et chaque détail dont la part est assez large pour être
 * lisible (minAngle). Une grande part a son texte le long de l'arc, une petite en travers de l'anneau.
 */
export function withLabels(option, total) {
  for (const series of [].concat(option.series ?? [])) {
    for (const node of series.data ?? []) {
      const color = node.itemStyle?.color
      node.label = { show: true, rotate: 0, color: textOn(color), fontWeight: 600, fontSize: 13, minAngle: 12, overflow: 'truncate', width: 90 }
      for (const child of node.children ?? []) {
        const wide = child.value / total >= 0.12
        child.label = {
          show: true,
          rotate: wide ? 'tangential' : 'radial',
          color: textOn(child.itemStyle?.color),
          fontSize: 11,
          minAngle: 7,
          overflow: 'truncate',
          width: wide ? 160 : 90,
        }
      }
    }
  }
  return option
}

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
