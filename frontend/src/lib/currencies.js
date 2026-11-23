// Devises du graphique « Patrimoine par devise » (lib/charts/flowCurrency.js).
//
// Les devises disponibles sont celles qui ont une colonne de montants dans la table history (EUR, USD, CHF, THB).
// Le choix (devises cochées) est gardé sur le profil, en base (PUT /api/profile/ { chart_currencies }) : celui
// du compte connecté, sinon celui du site. Choix vide = toutes les devises disponibles.

import { ref } from 'vue'
import { saveProfileCurrencies } from './api.js'
import { findCurrencyColumn } from './charts/flowData.js'

/** Devises connues, dans l'ordre d'affichage. */
export const KNOWN_CURRENCIES = ['EUR', 'USD', 'CHF', 'THB']

const CODE = /^[A-Z]{3}$/

/** Devises cochées (réactif : le graphique se redessine quand le choix change). */
export const chartCurrencies = ref([])
/** Dernière erreur d'enregistrement du choix (message déjà traduit), sinon ''. */
export const currencyError = ref('')

const valid = (list) => [...new Set((Array.isArray(list) ? list : []).map((code) => String(code).toUpperCase()))].filter((code) => CODE.test(code))

/** Choix reçu avec le profil (lib/profile.js). */
export function applyProfileCurrencies(profile) {
  chartCurrencies.value = valid(profile?.chart_currencies)
  currencyError.value = ''
}

/** Devises disponibles dans la table : [{ code, column }], dans l'ordre de KNOWN_CURRENCIES. */
export function availableCurrencies(columns) {
  return KNOWN_CURRENCIES.map((code) => ({ code, column: findCurrencyColumn(columns, code) })).filter((item) => item.column)
}

/** Devises à afficher parmi celles disponibles : le choix enregistré, sinon toutes. */
export function selectedCurrencies(available) {
  const codes = available.map((item) => item.code)
  const chosen = chartCurrencies.value.filter((code) => codes.includes(code))
  return chosen.length ? codes.filter((code) => chosen.includes(code)) : codes
}

let version = 0

/** Enregistre le choix ; affiché tout de suite, remis comme avant si le serveur refuse. */
export async function setChartCurrencies(codes) {
  const previous = chartCurrencies.value
  const mine = ++version
  chartCurrencies.value = valid(codes)
  try {
    await saveProfileCurrencies(chartCurrencies.value)
    currencyError.value = ''
  } catch (error) {
    if (version === mine) chartCurrencies.value = previous
    currencyError.value = error.message
  }
}
