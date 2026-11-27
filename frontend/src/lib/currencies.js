// Devises du graphique « Patrimoine par devise » (lib/charts/flowCurrency.js).
//
// Devises proposées : celles que le serveur sait calculer avec les taux de la BCE (table.currencies_available,
// googlesheet/currencies.py), et celles qui ont une colonne dans la feuille. Le serveur n'envoie en colonnes que les
// devises cochées (ou EUR, USD, CHF, THB tant que rien n'est choisi), plus la devise d'affichage de l'en-tête
// (lib/displayCurrency.js) : en cocher une nouvelle recharge la table.
// Le choix est gardé sur le profil, en base (PUT /api/profile/ { chart_currencies }) : celui du compte connecté,
// sinon celui du site. Choix vide = devises par défaut. Enregistrement et retour en arrière : lib/profileSetting.js.

import { findCurrencyColumn } from './charts/flowData.js'
import { createProfileSetting } from './profileSetting.js'

/** Devises connues, dans l'ordre d'affichage. */
export const KNOWN_CURRENCIES = ['EUR', 'USD', 'CHF', 'THB']

const CODE = /^[A-Z]{3}$/

const valid = (list) => [...new Set((Array.isArray(list) ? list : []).map((code) => String(code).toUpperCase()))].filter((code) => CODE.test(code))

export const chartCurrenciesSetting = createProfileSetting({ field: 'chart_currencies', default: () => [], validate: valid })

/** Devises cochées (réactif : le graphique se redessine quand le choix change). */
export const chartCurrencies = chartCurrenciesSetting.value
/** Dernière erreur d'enregistrement du choix (message déjà traduit), sinon ''. */
export const currencyError = chartCurrenciesSetting.error

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

/**
 * Devises à afficher parmi celles disponibles : le choix enregistré, sinon EUR, USD, CHF et THB (le serveur ajoute
 * aussi la colonne de la devise d'affichage de l'en-tête : elle n'apparaît ici que si elle est cochée), sinon toutes.
 */
export function selectedCurrencies(available) {
  const codes = available.map((item) => item.code)
  const chosen = chartCurrencies.value.filter((code) => codes.includes(code))
  if (chosen.length) return codes.filter((code) => chosen.includes(code))
  const known = codes.filter((code) => KNOWN_CURRENCIES.includes(code))
  return known.length ? known : codes
}

/** Enregistre le choix ; affiché tout de suite, remis comme avant si le serveur refuse. Vrai si enregistré. */
export const setChartCurrencies = (codes) => chartCurrenciesSetting.set(codes)
