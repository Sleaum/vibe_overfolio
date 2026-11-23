// Profil gardé en base (GET /api/profile/) : celui du compte connecté, sinon celui du site.
// Il porte les couleurs des types d'actifs (lib/palette.js) et, pour un compte, le mode clair / sombre
// (composables/useTheme.js). À recharger après une connexion ou une déconnexion.

import { getProfile } from './api.js'
import { loadSession, session, takeFirstLogin } from './auth.js'
import { applyProfileAssetColors, assetColorError } from './palette.js'
import { applyProfileTheme } from '../composables/useTheme.js'

export async function loadProfile() {
  try {
    const profile = await getProfile()
    await applyProfileAssetColors(profile)
    await applyProfileTheme(profile.theme ?? '', { authenticated: session.authenticated, firstLogin: takeFirstLogin() })
  } catch (error) {
    assetColorError.value = error.message
  }
}

/** Au démarrage : état de la connexion, puis réglages du profil. */
export async function startSession() {
  await loadSession()
  await loadProfile()
}
