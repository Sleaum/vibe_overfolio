// Choix de périodes (pastilles de WindowsPicker.vue) : une liste de nombres (mois, jours…), qu'on complète ou réduit.
//
// - Gardée par le navigateur (une préférence de lib/preferences.js, « 1,3,12 ») ; avec un compte connecté, aussi sur
//   son profil en base (un champ de PUT /api/profile/), retrouvée sur tous ses appareils. À la première connexion,
//   le profil reprend le choix du navigateur. Enregistrement et retour en arrière : lib/profileSetting.js.
// - Au moins une période ; `maxValue` et `maxCount` bornent la liste.
// Utilisé par lib/volatilityWindows.js (Volatility, en mois) et lib/performanceWindows.js (Snapshot, en jours).

import { createProfileSetting } from './profileSetting.js'

/**
 * @param {object} options
 * @param {string} options.preference nom de la préférence du navigateur (« 1,3,12 »)
 * @param {string} options.profileField champ du profil en base
 * @param {number[]} options.defaults périodes par défaut
 * @param {number} options.maxValue plus grande période
 * @param {number} options.maxCount nombre de périodes au plus
 */
export function createWindows({ preference, profileField, defaults, maxValue, maxCount }) {
  /** Liste du profil ([…]) ou du navigateur (« 1,3,6 ») -> périodes triées, sans doublon, bornées ; null si aucune. */
  const clean = (raw) => {
    const list = typeof raw === 'string' ? raw.split(',') : Array.isArray(raw) ? raw : []
    const numbers = [...new Set(list.map(Number))]
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= maxValue)
      .sort((a, b) => a - b)
      .slice(0, maxCount)
    return numbers.length ? numbers : null
  }

  const setting = createProfileSetting({
    field: profileField,
    preference,
    default: () => [...defaults],
    validate: clean,
    serialize: (list) => (list.join(',') === defaults.join(',') ? [] : list), // [] = par défaut, sur le profil
    toPreference: (list) => list.join(','),
    onlyWhenSignedIn: true,
  })

  /** Ajoute une période ; renvoie 'added', 'invalid', 'exists' ou 'full'. */
  async function add(value) {
    const number = Number(value)
    if (!Number.isInteger(number) || number < 1 || number > maxValue) return 'invalid'
    if (setting.value.value.includes(number)) return 'exists'
    if (setting.value.value.length >= maxCount) return 'full'
    await setting.set([...setting.value.value, number])
    return 'added'
  }

  /** Retire une période (la dernière reste). */
  async function remove(value) {
    const next = setting.value.value.filter((n) => n !== value)
    if (next.length) await setting.set(next)
  }

  return { ...setting, list: setting.value, add, remove, maxValue, maxCount, defaults }
}
