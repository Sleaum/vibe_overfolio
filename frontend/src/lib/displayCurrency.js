// Devise d'affichage des pages Charts et Simulation (menu de l'en-tête, CurrencySelect.vue).
//
// - Liste : l'euro et les devises cotées par la BCE le dernier jour publié (GET /api/fx/currencies/), avec ce taux.
// - Choix : par défaut l'euro. Gardé par le navigateur (préférence « currency » de lib/preferences.js) ; avec un compte
//   connecté, aussi sur son profil en base (display_currency), retrouvé sur tous ses appareils. Enregistrement et
//   retour en arrière : lib/profileSetting.js.
// - Effet : useTable demande les tables dans cette devise (GET /api/data/<onglet>/?currency=THB : le serveur
//   convertit les montants au taux du jour de chaque ligne) ; lib/format.js écrit les montants avec son symbole ;
//   la page affichée est refaite au changement (App.vue). La page GoogleSheet garde les montants en euros.

import { ref } from 'vue'
import { getCurrencies } from './api.js'
import { createProfileSetting } from './profileSetting.js'

export const DEFAULT_CURRENCY = 'EUR'
const CODE = /^[A-Z]{3}$/

const valid = (code) => (typeof code === 'string' && CODE.test(code.trim().toUpperCase()) ? code.trim().toUpperCase() : '')

/** Devises proposées : [{ code, rate }] (taux = unités pour 1 EUR, au dernier jour publié). */
export const currencyList = ref([{ code: DEFAULT_CURRENCY, rate: 1 }])
/** Jour des taux de la liste ('AAAA-MM-JJ'), ou '' tant que la base n'a pas de taux. */
export const ratesDate = ref('')

let listLoaded = false
const listed = (code) => !listLoaded || currencyList.value.some((item) => item.code === code)

export const displayCurrencySetting = createProfileSetting({
  field: 'display_currency',
  preference: 'currency',
  default: DEFAULT_CURRENCY,
  // '' sur le profil = euro ; une devise que la liste chargée ne propose pas est refusée
  validate: (raw) => {
    if (raw === '') return DEFAULT_CURRENCY
    const code = valid(raw)
    return code && listed(code) ? code : null
  },
  serialize: (code) => (code === DEFAULT_CURRENCY ? '' : code),
  toPreference: (code) => code,
  onlyWhenSignedIn: true,
})

/** Devise choisie (réactif). */
export const displayCurrency = displayCurrencySetting.value

/** Charge la liste ; une devise choisie qui n'y est pas (plus cotée, base sans taux) revient à l'euro. */
export async function loadCurrencies() {
  try {
    const body = await getCurrencies()
    const list = (body?.currencies ?? []).filter((item) => valid(item?.code) && Number(item.rate) > 0)
    currencyList.value = list.length ? list : [{ code: DEFAULT_CURRENCY, rate: 1 }]
    ratesDate.value = body?.date ?? ''
    listLoaded = true
  } catch {
    return // liste indisponible : le choix enregistré reste, le serveur dira si la devise est inconnue
  }
  // Devise gardée que la liste ne propose plus (plus cotée, base sans taux) : l'euro, sans rien enregistrer
  if (!listed(displayCurrency.value)) displayCurrency.value = DEFAULT_CURRENCY
}

/** Choix dans le menu de l'en-tête : appliqué tout de suite ; un compte connecté l'enregistre aussi sur son profil. */
export const setDisplayCurrency = (code) => displayCurrencySetting.set(code)

/** Taux de la liste : unités de `code` pour 1 EUR, ou null. */
function latestRate(code) {
  if (code === DEFAULT_CURRENCY) return 1
  const rate = currencyList.value.find((item) => item.code === code)?.rate
  return Number(rate) > 0 ? Number(rate) : null
}

/**
 * Montant converti d'une devise à l'autre au dernier taux (réglages de la Simulation enregistrés dans une autre
 * devise). null si un taux manque.
 */
export function convertLatest(amount, from, to) {
  const value = Number(amount)
  if (!Number.isFinite(value)) return null
  if (from === to) return value
  const fromRate = latestRate(from)
  const toRate = latestRate(to)
  return fromRate && toRate ? (value / fromRate) * toRate : null
}
