// Périodes du graphique « Variation des prix par sous-type » de Snapshot, en jours (30, 90 et 365 par défaut).
// Choix gardé par le navigateur (préférence « performance ») et, connecté, sur le profil (performance_days) :
// voir lib/windows.js. Le graphique : lib/charts/subAssetPerformance.js.

import { createWindows } from './windows.js'

export const performanceWindows = createWindows({
  preference: 'performance',
  profileField: 'performance_days',
  defaults: [30, 90, 365],
  maxValue: 3650, // 10 ans
  maxCount: 8,
})

/** Périodes affichées, en jours (réactif). */
export const performanceDays = performanceWindows.list
