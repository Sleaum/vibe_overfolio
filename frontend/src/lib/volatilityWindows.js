// Périodes de la page Volatility (VolatilityWindows.vue) : un graphique par nombre de mois (1 mois, 3 mois, 1 an…).
//
// - Par défaut : 1, 3 et 12 mois. On en ajoute (nombre de mois) ou on en retire d'un clic ; au moins une reste.
// - Gardées par le navigateur (préférence « volatility » de lib/preferences.js) ; avec un compte connecté, aussi sur son
//   profil en base (volatility_months), retrouvées sur tous ses appareils. À la première connexion, le profil reprend
//   le choix du navigateur.
// - Les graphiques correspondants : volatilityCharts() de lib/charts/volatility.js.

import { ref } from 'vue'
import { saveProfileVolatility } from './api.js'
import { session } from './auth.js'
import { readPreference, writePreference } from './preferences.js'

export const DEFAULT_MONTHS = [1, 3, 12]
export const MAX_MONTHS = 240 // 20 ans
export const MAX_WINDOWS = 12

/** Liste propre : entiers de 1 à 240, sans doublon, triés ; null si rien de valable. */
export function cleanMonths(list) {
  const months = [...new Set((Array.isArray(list) ? list : []).map(Number))]
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= MAX_MONTHS)
    .sort((a, b) => a - b)
    .slice(0, MAX_WINDOWS)
  return months.length ? months : null
}

const stored = () => cleanMonths(String(readPreference('volatility') ?? '').split(','))

/** Périodes affichées, en mois (réactif : la page Volatility ajoute ou retire les graphiques). */
export const volatilityMonths = ref(stored() ?? DEFAULT_MONTHS)
/** Dernière erreur d'enregistrement sur le compte (message déjà traduit), sinon ''. */
export const volatilityError = ref('')

const isDefault = (months) => months.join(',') === DEFAULT_MONTHS.join(',')

function apply(months) {
  volatilityMonths.value = months
  writePreference('volatility', isDefault(months) ? null : months.join(','))
}

let version = 0

/** Nouveau choix : affiché tout de suite ; un compte connecté l'enregistre, et le retrouve tel quel si le serveur refuse. */
async function choose(months) {
  const previous = volatilityMonths.value
  const mine = ++version
  apply(months)
  volatilityError.value = ''
  if (!session.authenticated) return true
  try {
    await saveProfileVolatility(isDefault(months) ? [] : months)
    return true
  } catch (error) {
    if (version === mine) apply(previous)
    volatilityError.value = error.message
    return false
  }
}

/** Ajoute une période ; renvoie 'added', 'invalid', 'exists' ou 'full'. */
export async function addWindow(value) {
  const months = Number(value)
  if (!Number.isInteger(months) || months < 1 || months > MAX_MONTHS) return 'invalid'
  if (volatilityMonths.value.includes(months)) return 'exists'
  if (volatilityMonths.value.length >= MAX_WINDOWS) return 'full'
  await choose(cleanMonths([...volatilityMonths.value, months]))
  return 'added'
}

/** Retire une période (la dernière reste). */
export async function removeWindow(months) {
  const next = volatilityMonths.value.filter((n) => n !== months)
  if (next.length) await choose(next)
}

/**
 * Périodes du profil d'un compte connecté ([] = par défaut). À la création du compte (firstLogin), un profil sans
 * périodes reprend celles de ce navigateur. Un visiteur garde la préférence de son navigateur.
 */
export async function applyProfileVolatility(profile, { authenticated = false, firstLogin = false } = {}) {
  if (!authenticated) return
  const fromProfile = cleanMonths(profile?.volatility_months)
  if (!fromProfile && firstLogin && !isDefault(volatilityMonths.value)) {
    await saveProfileVolatility(volatilityMonths.value).catch(() => {})
    return
  }
  apply(fromProfile ?? DEFAULT_MONTHS)
}
