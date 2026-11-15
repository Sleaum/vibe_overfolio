// Registre des graphiques et cartes de la page /graphiques.
//
// - CHARTS : les graphiques qui ont leur propre page /graphiques/<slug> (Flux du budget et les cinq de Portfolio Flow).
// - GALLERY : les cartes de la page /graphiques, dans l'ordre d'affichage. Trois sont des pages construites à la main
//   (Portfolio Flow, Portfolio Snapshot, Stratégie CTO), la quatrième est le graphique Flux du budget.
// Pour ajouter un graphique : créer un fichier de spécification (voir budgetFlow.js), l'ajouter à CHARTS, puis lui donner une
// carte dans GALLERY.

import budgetFlow from './budgetFlow.js'
import flowAllocation from './flowAllocation.js'
import flowAssets from './flowAssets.js'
import flowCurrency from './flowCurrency.js'
import flowTrend from './flowTrend.js'
import flowVariation from './flowVariation.js'

// Les cinq graphiques « Portfolio Flow » sont regroupés sur la page /portfolio-flow
export const FLOW_CHARTS = [flowCurrency, flowAllocation, flowAssets, flowVariation, flowTrend]

export const CHARTS = [budgetFlow, ...FLOW_CHARTS]

const PORTFOLIO_FLOW = { title: 'Portfolio Flow', to: '/portfolio-flow' }

/** Cartes de la page /graphiques. `thumb` : line | donut | sunburst | sankey (voir ChartThumb.vue). */
export const GALLERY = [
  {
    key: 'portfolio-flow',
    to: PORTFOLIO_FLOW.to,
    title: PORTFOLIO_FLOW.title,
    summary: 'L’historique de ton patrimoine mois par mois : devises, répartition, évolution par type d’actif, variation et tendance.',
    thumb: 'line',
  },
  {
    key: 'portfolio-snapshot',
    to: '/portfolio-snapshot',
    title: 'Portfolio Snapshot',
    summary: 'Ton patrimoine aujourd’hui : brut, net, variation de l’année et du mois, détail type d’actif par type d’actif.',
    thumb: 'donut',
  },
  {
    key: 'strategie',
    to: '/strategie',
    title: 'Stratégie CTO',
    summary: 'Tes actions en anneaux à deux niveaux : secteur, moat, localisation, note S&P, business et place de cotation.',
    thumb: 'sunburst',
  },
  {
    key: budgetFlow.slug,
    to: { name: 'ChartPage', params: { slug: budgetFlow.slug } },
    title: budgetFlow.title,
    summary: budgetFlow.summary,
    thumb: budgetFlow.thumb,
  },
]

export const getChart = (slug) => CHARTS.find((chart) => chart.slug === slug) ?? null

// Les liens « précédent » et « suivant » ne vont que d'un graphique à ses voisins de la même page
const SETS = [[budgetFlow], FLOW_CHARTS]

/** Graphiques voisins, pour les liens « précédent » et « suivant ». */
export function neighbours(slug) {
  const set = SETS.find((list) => list.some((chart) => chart.slug === slug)) ?? []
  const index = set.findIndex((chart) => chart.slug === slug)
  return {
    previous: index > 0 ? set[index - 1] : null,
    next: index >= 0 && index < set.length - 1 ? set[index + 1] : null,
  }
}

/** Page qui regroupe ce graphique (pour le fil d'Ariane), ou null s'il n'appartient à aucune. */
export const parentPage = (slug) => (FLOW_CHARTS.some((chart) => chart.slug === slug) ? PORTFOLIO_FLOW : null)
