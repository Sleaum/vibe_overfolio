// Devises du graphique « Patrimoine par devise » (lib/charts/flowCurrency.js).
//
// Devises proposées : celles que le serveur sait calculer avec les taux de la BCE (table.currencies_available,
// googlesheet/currencies.py), et celles qui ont une colonne dans la feuille. Le serveur n'envoie en colonnes que les
// devises cochées (ou EUR, USD, CHF, THB tant que rien n'est choisi) : en cocher une nouvelle recharge la table.
// Le choix est gardé sur le profil, en base (PUT /api/profile/ { chart_currencies }) : celui du compte connecté,
// sinon celui du site. Choix vide = devises par défaut.

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

/**
 * Devises de la table : `shown` = [{ code, column }] celles qui ont une colonne (feuille ou calcul du serveur),
 * `more` = codes que le serveur peut ajouter (à cocher : la table est rechargée avec leur colonne).
 */
export function availableCurrencies(table) {
  const columns = table?.columns ?? []
  const offered = [...new Set([...KNOWN_CURRENCIES, ...(table?.currencies_available ?? [])])]
  const order = table?.currencies_available?.length ? [...table.currencies_available, ...KNOWN_CURRENCIES] : KNOWN_CURRENCIES
  const codes = [...new Set(order)].filter((code) => offered.includes(code))
  const shown = codes.map((code) => ({ code, column: findCurrencyColumn(columns, code) })).filter((item) => item.column)
  const more = (table?.currencies_available ?? []).filter((code) => !shown.some((item) => item.code === code))
  return { shown, more }
}

/** Devises à afficher parmi celles disponibles : le choix enregistré, sinon toutes. */
export function selectedCurrencies(available) {
  const codes = available.map((item) => item.code)
  const chosen = chartCurrencies.value.filter((code) => codes.includes(code))
  return chosen.length ? codes.filter((code) => chosen.includes(code)) : codes
}

let version = 0

/** Enregistre le choix ; affiché tout de suite, remis comme avant si le serveur refuse. Vrai si enregistré. */
export async function setChartCurrencies(codes) {
  const previous = chartCurrencies.value
  const mine = ++version
  chartCurrencies.value = valid(codes)
  try {
    await saveProfileCurrencies(chartCurrencies.value)
    currencyError.value = ''
    return true
  } catch (error) {
    if (version === mine) chartCurrencies.value = previous
    currencyError.value = error.message
    return false
  }
}
