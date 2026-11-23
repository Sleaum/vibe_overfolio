// Devise d'affichage des pages Charts et Simulation (menu de l'en-tête, CurrencySelect.vue).
//
// - Liste : l'euro et les devises cotées par la BCE le dernier jour publié (GET /api/fx/currencies/), avec ce taux.
// - Choix : par défaut l'euro. Gardé par le navigateur (préférence « currency » de lib/preferences.js) ; avec un compte
//   connecté, aussi sur son profil en base (display_currency), retrouvé sur tous ses appareils.
// - Effet : useTable demande les tables dans cette devise (GET /api/data/<onglet>/?currency=THB : le serveur
//   convertit les montants au taux du jour de chaque ligne) ; lib/format.js écrit les montants avec son symbole ;
//   la page affichée est refaite au changement (App.vue). La page GoogleSheet garde les montants en euros.

import { ref } from 'vue'
import { getCurrencies, saveProfileDisplayCurrency } from './api.js'
import { session } from './auth.js'
import { readPreference, writePreference } from './preferences.js'

export const DEFAULT_CURRENCY = 'EUR'
const CODE = /^[A-Z]{3}$/

const valid = (code) => (typeof code === 'string' && CODE.test(code.trim().toUpperCase()) ? code.trim().toUpperCase() : '')

/** Devise choisie (réactif). */
export const displayCurrency = ref(valid(readPreference('currency')) || DEFAULT_CURRENCY)

/** Devises proposées : [{ code, rate }] (taux = unités pour 1 EUR, au dernier jour publié). */
export const currencyList = ref([{ code: DEFAULT_CURRENCY, rate: 1 }])
/** Jour des taux de la liste ('AAAA-MM-JJ'), ou '' tant que la base n'a pas de taux. */
export const ratesDate = ref('')

let listLoaded = false

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
  if (!currencyList.value.some((item) => item.code === displayCurrency.value)) displayCurrency.value = DEFAULT_CURRENCY
}

function apply(code) {
  displayCurrency.value = code
  writePreference('currency', code === DEFAULT_CURRENCY ? null : code)
}

/** Choix dans le menu de l'en-tête : appliqué tout de suite ; un compte connecté l'enregistre aussi sur son profil. */
export function setDisplayCurrency(code) {
  const next = valid(code)
  if (!next || next === displayCurrency.value) return
  if (listLoaded && !currencyList.value.some((item) => item.code === next)) return
  apply(next)
  if (session.authenticated) saveProfileDisplayCurrency(next === DEFAULT_CURRENCY ? '' : next).catch(() => {})
}

/**
 * Devise du profil d'un compte connecté ('' = euro). À la création du compte (firstLogin), un profil sans devise
 * reprend celle de ce navigateur. Un visiteur garde la préférence de son navigateur.
 */
export async function applyProfileDisplayCurrency(profile, { authenticated = false, firstLogin = false } = {}) {
  if (!authenticated) return
  const fromProfile = valid(profile?.display_currency)
  if (!fromProfile && firstLogin && displayCurrency.value !== DEFAULT_CURRENCY) {
    await saveProfileDisplayCurrency(displayCurrency.value).catch(() => {})
    return
  }
  const code = fromProfile || DEFAULT_CURRENCY
  if (listLoaded && !currencyList.value.some((item) => item.code === code)) return
  apply(code)
}

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
