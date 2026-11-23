// Périodes de la page Volatility, en mois : un graphique par période (1 mois, 3 mois, 1 an par défaut).
// Choix gardé par le navigateur (préférence « volatility ») et, connecté, sur le profil (volatility_months) :
// voir lib/windows.js. Les graphiques correspondants : volatilityCharts() de lib/charts/volatility.js.

import { createWindows } from './windows.js'

export const volatilityWindows = createWindows({
  preference: 'volatility',
  profileField: 'volatility_months',
  defaults: [1, 3, 12],
  maxValue: 240, // 20 ans
  maxCount: 12,
})

export const MAX_MONTHS = volatilityWindows.maxValue
/** Périodes affichées, en mois (réactif : la page Volatility ajoute ou retire les graphiques). */
export const volatilityMonths = volatilityWindows.list
export const applyProfileVolatility = volatilityWindows.applyProfile
