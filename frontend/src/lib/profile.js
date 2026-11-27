// Profil gardé en base (GET /api/profile/) : celui du compte connecté, sinon celui du site. À recharger après une
// connexion ou une déconnexion. Chaque réglage de SETTINGS est un createProfileSetting (lib/profileSetting.js) :
// il prend sa valeur dans le profil reçu, et l'y enregistre quand on la change.

import { getProfile } from './api.js'
import { loadSession, session, takeFirstLogin } from './auth.js'
import { chartCurrenciesSetting } from './currencies.js'
import { displayCurrencySetting, loadCurrencies } from './displayCurrency.js'
import { modelTargetSetting } from './modelTarget.js'
import { assetColorsSetting } from './palette.js'
import { performanceWindows } from './performanceWindows.js'
import { volatilityWindows } from './volatilityWindows.js'
import { themeSetting } from '../composables/useTheme.js'

/** Réglages gardés sur le profil, dans l'ordre où ils sont appliqués. */
export const SETTINGS = [
  assetColorsSetting, // couleurs des types d'actifs (menu de Charts)
  chartCurrenciesSetting, // devises de « Patrimoine par devise »
  themeSetting, // mode clair / sombre (compte connecté)
  displayCurrencySetting, // devise d'affichage de l'en-tête (compte connecté)
  volatilityWindows, // périodes de Volatility (compte connecté)
  performanceWindows, // périodes de Snapshot (compte connecté)
  modelTargetSetting, // cible de Models > Target
]

export async function loadProfile() {
  let profile
  try {
    profile = await getProfile()
  } catch (error) {
    assetColorsSetting.error.value = error.message // affiché sous les couleurs des actifs, comme avant
    return
  }
  const account = { authenticated: session.authenticated, firstLogin: takeFirstLogin() }
  for (const setting of SETTINGS) {
    try {
      await setting.applyProfile(profile, account)
    } catch (error) {
      setting.error.value = error.message // un réglage en erreur n'empêche pas les autres
    }
  }
}

/** Au démarrage : état de la connexion, puis réglages du profil ; en même temps, les devises proposées. */
export async function startSession() {
  await Promise.all([loadSession().then(loadProfile), loadCurrencies()])
}
