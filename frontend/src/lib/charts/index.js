// Registre des graphiques et du menu de la rubrique Graphiques.
//
// - GROUPS : les pages qui réunissent plusieurs graphiques (Portfolio Flow, Enveloppes, Volatilité), chacun dans une carte.
// - CHARTS : tous les graphiques qui ont leur propre page /graphiques/<slug> (Flux du budget et ceux des GROUPS).
// - MENU : les entrées du menu de gauche (GraphiquesLayout.vue), dans l'ordre d'affichage ; /graphiques ouvre la première.
//   Leur nom est toujours en anglais (i18n/menu.js), non traduit.
// Pour ajouter un graphique : créer un fichier de spécification (voir budgetFlow.js), puis l'ajouter à un groupe
// (il apparaît sur la page du groupe) ou à CHARTS avec une entrée dans MENU.

import budgetFlow from './budgetFlow.js'
import { ENVELOPE_CHARTS } from './envelopes.js'
import flowAllocation from './flowAllocation.js'
import flowAssets from './flowAssets.js'
import flowCurrency from './flowCurrency.js'
import flowDebts from './flowDebts.js'
import flowTrend from './flowTrend.js'
import flowVariation from './flowVariation.js'
import inout from './inout.js'
import { VOLATILITY_CHARTS } from './volatility.js'
import { t } from '../../i18n/index.js'
import { MENU_NAMES } from '../../i18n/menu.js'

// Les graphiques « Portfolio Flow » sont regroupés sur la page /portfolio-flow
// (« Tes dettes » ne s'y affiche qu'en mode Brut du bouton Brut / Net)
export const FLOW_CHARTS = [flowCurrency, flowAllocation, flowAssets, flowDebts, flowVariation, inout, flowTrend]
export { ENVELOPE_CHARTS, VOLATILITY_CHARTS }

const PORTFOLIO_FLOW = { key: 'portfolio-flow', titleKey: 'pages.flow', to: '/portfolio-flow', charts: FLOW_CHARTS }
const ENVELOPES = { key: 'enveloppes', titleKey: 'pages.envelopes', to: '/enveloppes', charts: ENVELOPE_CHARTS }
const VOLATILITY = { key: 'volatilite', titleKey: 'pages.volatility', to: '/volatilite', charts: VOLATILITY_CHARTS }
export const GROUPS = [PORTFOLIO_FLOW, ENVELOPES, VOLATILITY]

export const CHARTS = [budgetFlow, ...GROUPS.flatMap((group) => group.charts)]

const groupOf = (slug) => GROUPS.find((group) => group.charts.some((chart) => chart.slug === slug)) ?? null

/** Entrées du menu de la rubrique Graphiques, dans l'ordre de l'ancien rapport Data Studio. */
export const MENU = [
  {
    key: PORTFOLIO_FLOW.key,
    to: PORTFOLIO_FLOW.to,
    title: MENU_NAMES.flow,
  },
  {
    key: 'portfolio-snapshot',
    to: '/portfolio-snapshot',
    title: MENU_NAMES.snapshot,
  },
  {
    key: ENVELOPES.key,
    to: ENVELOPES.to,
    title: MENU_NAMES.envelopes,
  },
  {
    key: 'strategie',
    to: '/strategie',
    title: MENU_NAMES.strategy,
  },
  {
    key: VOLATILITY.key,
    to: VOLATILITY.to,
    title: MENU_NAMES.volatility,
  },
  {
    key: budgetFlow.slug,
    to: { name: 'ChartPage', params: { slug: budgetFlow.slug } },
    title: MENU_NAMES.budget,
  },
]

/**
 * Entrée du menu à mettre en avant pour une route : la page elle-même, ou, pour /graphiques/<slug>,
 * la page qui regroupe ce graphique (Portfolio Flow, Enveloppes, Volatilité) ou le graphique lui-même (Flux du budget).
 */
export function menuKeyFor(route) {
  if (route.name === 'ChartPage') {
    const slug = String(route.params.slug ?? '')
    const group = groupOf(slug)
    if (group) return group.key
    return MENU.some((item) => item.key === slug) ? slug : null
  }
  return MENU.find((item) => typeof item.to === 'string' && item.to === route.path)?.key ?? null
}

export const getChart = (slug) => CHARTS.find((chart) => chart.slug === slug) ?? null

// Les liens « précédent » et « suivant » ne vont que d'un graphique à ses voisins de la même page
const SETS = [[budgetFlow], ...GROUPS.map((group) => group.charts)]

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
export const parentPage = (slug) => {
  const group = groupOf(slug)
  return group ? { title: t(group.titleKey), to: group.to } : null
}
