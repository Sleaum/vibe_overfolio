// Profil gardé en base (GET /api/profile/) : celui du compte connecté, sinon celui du site.
// Il porte les couleurs des types d'actifs (lib/palette.js), les devises de « Patrimoine par devise »
// (lib/currencies.js) et, pour un compte, le mode clair / sombre (composables/useTheme.js), la devise
// d'affichage (lib/displayCurrency.js), les périodes de Volatility et de Snapshot (lib/windows.js) et la cible de
// Models > Target (lib/modelTarget.js). À recharger après une connexion ou une déconnexion.

import { getProfile } from './api.js'
import { loadSession, session, takeFirstLogin } from './auth.js'
import { applyProfileAssetColors, assetColorError } from './palette.js'
import { applyProfileCurrencies } from './currencies.js'
import { applyProfileDisplayCurrency, loadCurrencies } from './displayCurrency.js'
import { applyProfileVolatility } from './volatilityWindows.js'
import { applyProfilePerformance } from './performanceWindows.js'
import { applyProfileTarget } from './modelTarget.js'
import { applyProfileTheme } from '../composables/useTheme.js'

export async function loadProfile() {
  try {
    const profile = await getProfile()
    await applyProfileAssetColors(profile)
    applyProfileCurrencies(profile)
    const account = { authenticated: session.authenticated, firstLogin: takeFirstLogin() }
    await applyProfileTheme(profile.theme ?? '', account)
    await applyProfileDisplayCurrency(profile, account)
    await applyProfileVolatility(profile, account)
    await applyProfilePerformance(profile, account)
    applyProfileTarget(profile)
  } catch (error) {
    assetColorError.value = error.message
  }
}

/** Au démarrage : état de la connexion, puis réglages du profil ; en même temps, les devises proposées. */
export async function startSession() {
  await Promise.all([loadSession().then(loadProfile), loadCurrencies()])
}
