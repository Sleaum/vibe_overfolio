// Profil gardé en base (GET /api/profile/) : celui du compte connecté, sinon celui du site.
// Il porte les couleurs des types d'actifs (lib/palette.js), les devises de « Patrimoine par devise »
// (lib/currencies.js) et, pour un compte, le mode clair / sombre (composables/useTheme.js) et la devise
// d'affichage (lib/displayCurrency.js). À recharger après une connexion ou une déconnexion.

import { getProfile } from './api.js'
import { loadSession, session, takeFirstLogin } from './auth.js'
import { applyProfileAssetColors, assetColorError } from './palette.js'
import { applyProfileCurrencies } from './currencies.js'
import { applyProfileDisplayCurrency, loadCurrencies } from './displayCurrency.js'
import { applyProfileTheme } from '../composables/useTheme.js'

export async function loadProfile() {
  try {
    const profile = await getProfile()
    await applyProfileAssetColors(profile)
    applyProfileCurrencies(profile)
    const account = { authenticated: session.authenticated, firstLogin: takeFirstLogin() }
    await applyProfileTheme(profile.theme ?? '', account)
    await applyProfileDisplayCurrency(profile, account)
  } catch (error) {
    assetColorError.value = error.message
  }
}

/** Au démarrage : état de la connexion, puis réglages du profil ; en même temps, les devises proposées. */
export async function startSession() {
  await Promise.all([loadSession().then(loadProfile), loadCurrencies()])
}
