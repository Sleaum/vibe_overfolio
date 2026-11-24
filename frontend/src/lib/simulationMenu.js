// Menu de la rubrique Simulation (SimulationLayout.vue) : une entrée par méthode, dans l'ordre d'affichage.
// `ready` : la page est faite ; sinon l'entrée porte la mention « bientôt » et ouvre la présentation de la méthode
// (SimulationMethodPage.vue). Noms toujours en anglais (i18n/menu.js) ; textes des méthodes : rubrique simMethods.

import { MENU_NAMES } from '../i18n/menu.js'

export const SIMULATION_MENU = [
  { key: 'monteCarlo', to: '/simulation', ready: true },
  { key: 'backtest', to: '/simulation/backtest', ready: false },
  { key: 'stress', to: '/simulation/stress', ready: false },
  { key: 'scenarios', to: '/simulation/scenarios', ready: false },
  { key: 'parametric', to: '/simulation/parametrique', ready: false },
  { key: 'bootstrap', to: '/simulation/bootstrap', ready: false },
  { key: 'regimes', to: '/simulation/regimes', ready: false },
  { key: 'macro', to: '/simulation/macro', ready: false },
].map((item) => ({ ...item, title: MENU_NAMES[item.key] }))

/** Méthodes encore en préparation : une route de présentation chacune. */
export const UPCOMING_METHODS = SIMULATION_MENU.filter((item) => !item.ready)
