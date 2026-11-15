// Registre des graphiques : l'ordre ci-dessous est celui de la page d'index et des liens précédent / suivant.
// Pour ajouter un graphique : créer un fichier de spécification (voir evolution.js) et l'ajouter ici.

import accounts from './accounts.js'
import assetDonut from './assetDonut.js'
import budgetFlow from './budgetFlow.js'
import evolution from './evolution.js'
import inout from './inout.js'
import positions from './positions.js'
import zones from './zones.js'

export const CHART_GROUPS = [
  { id: 'evolution', title: 'Suivre l’évolution et les flux' },
  { id: 'repartition', title: 'Comprendre la répartition' },
]

export const CHARTS = [evolution, inout, budgetFlow, assetDonut, zones, accounts, positions]

export const getChart = (slug) => CHARTS.find((chart) => chart.slug === slug) ?? null

export const chartsOfGroup = (groupId) => CHARTS.filter((chart) => chart.group === groupId)

/** Graphiques voisins, pour les liens « précédent » et « suivant ». */
export function neighbours(slug) {
  const index = CHARTS.findIndex((chart) => chart.slug === slug)
  return {
    previous: index > 0 ? CHARTS[index - 1] : null,
    next: index >= 0 && index < CHARTS.length - 1 ? CHARTS[index + 1] : null,
  }
}
