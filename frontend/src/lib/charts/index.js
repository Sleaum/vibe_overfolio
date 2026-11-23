// Registre des graphiques et du menu de la rubrique Graphiques.
//
// - GROUPS : les pages qui réunissent des graphiques (Portfolio Flow, Snapshot, Enveloppes, Volatilité), chacun dans une carte.
// - allCharts() : tous les graphiques qui ont leur propre page /graphiques/<slug> (Flux du budget et ceux des GROUPS).
//   Ceux de Volatility suivent les périodes choisies sur la page (lib/volatilityWindows.js) ; l'adresse d'une autre
//   période (volatilite-6-mois) s'ouvre aussi.
// - MENU : les entrées du menu de gauche (GraphiquesLayout.vue), dans l'ordre d'affichage ; /graphiques ouvre la première.
//   Leur nom est toujours en anglais (i18n/menu.js), non traduit.
// Pour ajouter un graphique : créer un fichier de spécification (voir budgetFlow.js), puis l'ajouter à un groupe
// (il apparaît sur la page du groupe) ou à STATIC_CHARTS avec une entrée dans MENU.

import budgetFlow from './budgetFlow.js'
import { ENVELOPE_CHARTS } from './envelopes.js'
import flowAllocation from './flowAllocation.js'
import flowAssets from './flowAssets.js'
import flowCurrency from './flowCurrency.js'
import flowDebts from './flowDebts.js'
import flowTrend from './flowTrend.js'
import flowVariation from './flowVariation.js'
import inout from './inout.js'
import subAssetPerformance from './subAssetPerformance.js'
import { monthsOfSlug, volatilityChart, volatilityCharts } from './volatility.js'
import { volatilityMonths } from '../volatilityWindows.js'
import { t } from '../../i18n/index.js'
import { MENU_NAMES } from '../../i18n/menu.js'

// Les graphiques « Portfolio Flow » sont regroupés sur la page /portfolio-flow
// (« Tes dettes » ne s'y affiche qu'en mode Brut du bouton Brut / Net)
export const FLOW_CHARTS = [flowCurrency, flowAllocation, flowAssets, flowDebts, flowVariation, inout, flowTrend]
export { ENVELOPE_CHARTS }
// Graphique de la page Snapshot (sous « Ton patrimoine net ») : variation des prix par sous-type
export const SNAPSHOT_CHARTS = [subAssetPerformance]

/** Graphiques de Volatility des périodes choisies (réactif : à lire dans un computed). */
export const volatilityChartList = () => volatilityCharts(volatilityMonths.value)

const PORTFOLIO_FLOW = { key: 'portfolio-flow', titleKey: 'pages.flow', to: '/portfolio-flow', charts: FLOW_CHARTS }
const ENVELOPES = { key: 'enveloppes', titleKey: 'pages.envelopes', to: '/enveloppes', charts: ENVELOPE_CHARTS }
const VOLATILITY = {
  key: 'volatilite',
  titleKey: 'pages.volatility',
  to: '/volatilite',
  get charts() {
    return volatilityChartList()
  },
  has: (slug) => monthsOfSlug(slug) !== null, // toute période, même non choisie
}
const SNAPSHOT = { key: 'portfolio-snapshot', titleKey: 'pages.snapshot', to: '/portfolio-snapshot', charts: SNAPSHOT_CHARTS }
export const GROUPS = [PORTFOLIO_FLOW, SNAPSHOT, ENVELOPES, VOLATILITY]

const STATIC_CHARTS = [budgetFlow]

/** Tous les graphiques qui ont leur page (Volatility : périodes choisies). */
export const allCharts = () => [...STATIC_CHARTS, ...GROUPS.flatMap((group) => group.charts)]

const groupOf = (slug) =>
  GROUPS.find((group) => group.has?.(slug) || group.charts.some((chart) => chart.slug === slug)) ?? null

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

export const getChart = (slug) => {
  const months = monthsOfSlug(slug)
  return months !== null ? volatilityChart(months) : (allCharts().find((chart) => chart.slug === slug) ?? null)
}

/** Graphiques voisins, pour les liens « précédent » et « suivant » (seulement entre graphiques d'une même page). */
export function neighbours(slug) {
  const sets = [STATIC_CHARTS, ...GROUPS.map((group) => group.charts)]
  const set = sets.find((list) => list.some((chart) => chart.slug === slug)) ?? []
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
