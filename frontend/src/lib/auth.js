// Connexion avec un compte Google (session Django, voir backend/accounts).
//
// `session` est réactif : l'en-tête (components/AccountMenu.vue) et la page /newpage s'y abonnent.
// Se connecter est une navigation (pas un fetch) : le serveur part chez Google, puis revient sur `next`.

import { reactive } from 'vue'
import { getSession, logoutSession, setSheetScope } from './api.js'

export const session = reactive({
  loaded: false, // première réponse du serveur reçue
  configured: false, // connexion Google réglée sur le serveur (.env)
  authenticated: false,
  user: null, // { email, name, picture }
  error: '', // serveur injoignable : message déjà traduit
})

let firstLogin = false

/** Demande au serveur l'état de la connexion (pose aussi le cookie CSRF). */
export async function loadSession() {
  try {
    const body = await getSession()
    session.configured = Boolean(body.configured)
    session.authenticated = Boolean(body.authenticated)
    session.user = body.user ?? null
    session.error = ''
    firstLogin = Boolean(body.first_login)
    setSheetScope(session.authenticated ? 'account' : 'site')
  } catch (error) {
    session.error = error.message
  } finally {
    session.loaded = true
  }
  return session
}

/** Vrai une seule fois, juste après la création du compte : le site recopie alors ses réglages du navigateur. */
export function takeFirstLogin() {
  const value = firstLogin
  firstLogin = false
  return value
}

/** Page du site où revenir après la connexion : une adresse interne seulement. */
export function safeNext(value) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')
    ? value
    : '/'
}

/** Part se connecter chez Google, puis revenir sur `next`. */
export function signIn(next = '/') {
  window.location.assign(`/api/auth/google/start/?next=${encodeURIComponent(safeNext(next))}`)
}

/**
 * Déconnexion, puis rechargement complet de la page : plus rien du compte (données, réglages) ne reste affiché,
 * et la page repart avec le profil et les données du site.
 */
export async function signOut() {
  const body = await logoutSession()
  session.authenticated = false
  session.user = null
  session.configured = Boolean(body?.configured)
  window.location.reload()
}
