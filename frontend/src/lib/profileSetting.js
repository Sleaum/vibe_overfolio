// Un réglage gardé sur le profil en base (PUT /api/profile/), et parfois aussi par le navigateur
// (préférence de lib/preferences.js). Un seul comportement pour tous les réglages (lib/profile.js en donne la liste) :
//
// - set(valeur) : la valeur est validée, affichée tout de suite (et gardée par le navigateur), puis enregistrée.
//   Si le serveur refuse, elle revient à la dernière valeur confirmée par le serveur, et `error` porte le message.
// - Les enregistrements partent un par un, dans l'ordre : le dernier choix est toujours celui qui reste en base.
//   Une valeur remplacée avant son envoi n'est pas envoyée, et la réponse d'un choix dépassé ne change plus rien.
// - applyProfile(profil, { authenticated, firstLogin }) : applique la valeur du profil reçu. À la création d'un
//   compte (firstLogin), un réglage gardé aussi par le navigateur, encore vide sur le profil, reprend celui du
//   navigateur au lieu de l'écraser.
// - onlyWhenSignedIn : réglage du navigateur pour un visiteur, du profil pour un compte connecté (thème, devise
//   d'affichage, périodes) ; sinon, le profil en vigueur (celui du site pour un visiteur) décide.

import { ref } from 'vue'
import { saveProfile } from './api.js'
import { session } from './auth.js'
import { readPreference, writePreference } from './preferences.js'

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

/**
 * @param {object} options
 * @param {string} options.field champ du profil (GET / PUT /api/profile/)
 * @param {*} options.default valeur par défaut (une fonction pour un objet ou un tableau : une copie à chaque fois)
 * @param {(raw: *) => *} options.validate valeur reçue (du profil, du navigateur ou d'un choix) -> valeur, ou null
 * @param {(value: *) => *} [options.serialize] valeur -> ce que le profil enregistre (par défaut, la valeur)
 * @param {string} [options.preference] nom de la préférence du navigateur (lue par validate) ; absente par défaut
 * @param {(value: *) => string} [options.toPreference] valeur -> texte gardé par le navigateur
 * @param {boolean} [options.onlyWhenSignedIn] enregistré et lu sur le profil seulement pour un compte connecté
 */
export function createProfileSetting({
  field,
  default: fallback,
  validate,
  serialize = (value) => value,
  preference = null,
  toPreference = (value) => String(value),
  onlyWhenSignedIn = false,
}) {
  const initial = () => (typeof fallback === 'function' ? fallback() : fallback)
  const isDefault = (value) => same(value, initial())

  /** Valeur en vigueur (réactive). */
  const value = ref((preference && validate(readPreference(preference))) ?? initial())
  /** Dernière erreur d'enregistrement (message déjà traduit), sinon ''. */
  const error = ref('')

  let confirmed = value.value // dernière valeur que le serveur a acceptée (ou lue sur le profil)
  let version = 0 // numéro du dernier choix
  let queue = Promise.resolve()

  function show(next) {
    value.value = next
    if (preference) writePreference(preference, isDefault(next) ? null : toPreference(next))
  }

  const send = (next) => saveProfile({ [field]: serialize(next) })

  /** Nouveau choix ; renvoie true s'il est enregistré (ou s'il n'y a rien à enregistrer), false s'il est refusé. */
  function set(raw) {
    const next = validate(raw)
    if (next === null || next === undefined) return Promise.resolve(false)
    if (same(next, value.value)) return Promise.resolve(true)
    const mine = ++version
    show(next)
    error.value = ''
    if (onlyWhenSignedIn && !session.authenticated) {
      confirmed = next
      return Promise.resolve(true)
    }
    const done = queue.then(async () => {
      if (mine !== version) return true // un choix plus récent partira à sa place
      try {
        await send(next)
        confirmed = next
        return true
      } catch (err) {
        if (mine === version) {
          show(confirmed)
          error.value = err.message
        }
        return false
      }
    })
    queue = done
    return done
  }

  /** Valeur du profil reçu (lib/profile.js), au démarrage et après une connexion ou une déconnexion. */
  async function applyProfile(profile, { authenticated = false, firstLogin = false } = {}) {
    if (onlyWhenSignedIn && !authenticated) return // visiteur : le navigateur décide
    const fromProfile = validate(profile?.[field])
    const empty = fromProfile === null || fromProfile === undefined || isDefault(fromProfile)
    version++ // un enregistrement encore en cours ne reviendra pas sur ce que dit le profil
    error.value = ''
    if (empty && firstLogin && preference && !isDefault(value.value)) {
      confirmed = value.value
      try {
        await send(value.value)
      } catch (err) {
        error.value = err.message
      }
      return
    }
    show(empty ? initial() : fromProfile)
    confirmed = value.value
  }

  return { value, error, set, applyProfile, field }
}
