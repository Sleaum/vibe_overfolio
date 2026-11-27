// Cible de la page Models > Target, gardée sur le profil (PUT /api/profile/ {"model_target": …}) : celui du compte
// connecté, sinon celui du site. Chargée avec le profil (lib/profile.js), enregistrée à chaque changement ;
// enregistrement et retour en arrière : lib/profileSetting.js.
// Forme : { year, basis: 'types' | 'classes', types: { type: % }, classes: { classe: % }, monthly: nombre | null }.

import { createProfileSetting } from './profileSetting.js'
import { BASES, DEFAULT_YEAR } from './target.js'

const EMPTY = () => ({ year: DEFAULT_YEAR, basis: 'types', types: {}, classes: {}, monthly: null })

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

export const modelTargetSetting = createProfileSetting({
  field: 'model_target',
  default: EMPTY,
  validate: normalize,
  serialize: (target) => (JSON.stringify(target) === JSON.stringify(EMPTY()) ? {} : target), // {} = effacée
})

/** Cible en cours (réactive). */
export const modelTarget = modelTargetSetting.value
/** Dernière erreur d'enregistrement (message déjà traduit), sinon ''. */
export const targetError = modelTargetSetting.error

/** Change la cible (affichée tout de suite) et l'enregistre sur le profil. */
export const updateTarget = (patch) => modelTargetSetting.set({ ...modelTarget.value, ...patch })

/** Efface la cible du profil. */
export const clearTarget = () => modelTargetSetting.set(EMPTY())
