// Choix de périodes (pastilles de WindowsPicker.vue) : une liste de nombres (mois, jours…), qu'on complète ou réduit.
//
// - Gardée par le navigateur (une préférence de lib/preferences.js) ; avec un compte connecté, aussi sur son profil en
//   base (un champ de PUT /api/profile/), retrouvée sur tous ses appareils. À la première connexion, le profil reprend
//   le choix du navigateur.
// - Au moins une période ; `maxValue` et `maxCount` bornent la liste.
// Utilisé par lib/volatilityWindows.js (Volatility, en mois) et lib/performanceWindows.js (Snapshot, en jours).

import { ref } from 'vue'
import { saveProfileSettings } from './api.js'
import { session } from './auth.js'
import { readPreference, writePreference } from './preferences.js'

/**
 * @param {object} options
 * @param {string} options.preference nom de la préférence du navigateur (« 1,3,12 »)
 * @param {string} options.profileField champ du profil en base
 * @param {number[]} options.defaults périodes par défaut
 * @param {number} options.maxValue plus grande période
 * @param {number} options.maxCount nombre de périodes au plus
 */
export function createWindows({ preference, profileField, defaults, maxValue, maxCount }) {
  const clean = (list) => {
    const numbers = [...new Set((Array.isArray(list) ? list : []).map(Number))]
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= maxValue)
      .sort((a, b) => a - b)
      .slice(0, maxCount)
    return numbers.length ? numbers : null
  }
  const isDefault = (list) => list.join(',') === defaults.join(',')

  /** Périodes affichées (réactif). */
  const list = ref(clean(String(readPreference(preference) ?? '').split(',')) ?? defaults)
  /** Dernière erreur d'enregistrement sur le compte (message déjà traduit), sinon ''. */
  const error = ref('')

  function apply(next) {
    list.value = next
    writePreference(preference, isDefault(next) ? null : next.join(','))
  }

  let version = 0
  const save = (next) => saveProfileSettings({ [profileField]: isDefault(next) ? [] : next })

  /** Nouveau choix : affiché tout de suite ; un compte connecté l'enregistre, et le retrouve tel quel si le serveur refuse. */
  async function choose(next) {
    const previous = list.value
    const mine = ++version
    apply(next)
    error.value = ''
    if (!session.authenticated) return
    try {
      await save(next)
    } catch (err) {
      if (version === mine) apply(previous)
      error.value = err.message
    }
  }

  /** Ajoute une période ; renvoie 'added', 'invalid', 'exists' ou 'full'. */
  async function add(value) {
    const number = Number(value)
    if (!Number.isInteger(number) || number < 1 || number > maxValue) return 'invalid'
    if (list.value.includes(number)) return 'exists'
    if (list.value.length >= maxCount) return 'full'
    await choose(clean([...list.value, number]))
    return 'added'
  }

  /** Retire une période (la dernière reste). */
  async function remove(value) {
    const next = list.value.filter((n) => n !== value)
    if (next.length) await choose(next)
  }

  /** Périodes du profil d'un compte connecté ([] = par défaut) ; un visiteur garde celles de son navigateur. */
  async function applyProfile(profile, { authenticated = false, firstLogin = false } = {}) {
    if (!authenticated) return
    const fromProfile = clean(profile?.[profileField])
    if (!fromProfile && firstLogin && !isDefault(list.value)) {
      await save(list.value).catch(() => {})
      return
    }
    apply(fromProfile ?? defaults)
  }

  return { list, error, add, remove, applyProfile, maxValue, maxCount, defaults }
}
