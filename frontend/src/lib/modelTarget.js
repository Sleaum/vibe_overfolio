// Cible de la page Models > Target, gardée sur le profil (PUT /api/profile/ {"model_target": …}) : celui du compte
// connecté, sinon celui du site. Chargée avec le profil (lib/profile.js), enregistrée peu après chaque changement.
// Forme : { year, basis: 'types' | 'classes', types: { type: % }, classes: { classe: % }, monthly: nombre | null }.

import { ref } from 'vue'
import { saveProfileSettings } from './api.js'
import { BASES, DEFAULT_YEAR } from './target.js'

const EMPTY = () => ({ year: DEFAULT_YEAR, basis: 'types', types: {}, classes: {}, monthly: null })

/** Cible en cours (réactive). `saved` : false tant que la cible n'a jamais été réglée. */
export const modelTarget = ref(EMPTY())
export const targetSaved = ref(false)
/** Dernière erreur d'enregistrement (message déjà traduit), sinon ''. */
export const targetError = ref('')

function normalize(value) {
  const base = EMPTY()
  if (!value || typeof value !== 'object' || !Object.keys(value).length) return base
  return {
    year: Number.isInteger(value.year) ? value.year : base.year,
    basis: BASES.includes(value.basis) ? value.basis : base.basis,
    types: { ...(value.types ?? {}) },
    classes: { ...(value.classes ?? {}) },
    monthly: typeof value.monthly === 'number' ? value.monthly : null,
  }
}

/** Cible du profil reçu (GET /api/profile/). */
export function applyProfileTarget(profile) {
  const value = profile?.model_target
  modelTarget.value = normalize(value)
  targetSaved.value = Boolean(value && Object.keys(value).length)
}

let timer = null

/** Change la cible (affichée tout de suite) et l'enregistre sur le profil 600 ms après le dernier changement. */
export function updateTarget(patch) {
  modelTarget.value = { ...modelTarget.value, ...patch }
  targetSaved.value = true
  clearTimeout(timer)
  timer = setTimeout(async () => {
    try {
      await saveProfileSettings({ model_target: modelTarget.value })
      targetError.value = ''
    } catch (error) {
      targetError.value = error.message
    }
  }, 600)
}

/** Efface la cible du profil. */
export async function clearTarget() {
  clearTimeout(timer)
  modelTarget.value = EMPTY()
  targetSaved.value = false
  try {
    await saveProfileSettings({ model_target: {} })
    targetError.value = ''
  } catch (error) {
    targetError.value = error.message
  }
}
