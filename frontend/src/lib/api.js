// Appels à l'API Django. Chemins relatifs : nginx (ou le proxy de Vite en développement) les envoie au backend.
//
//   GET  /api/data/                 -> [{ name, row_count, synced_at }]
//   GET  /api/data/<onglet>/        -> { name, columns[], rows[{colonne: valeur}], row_count, synced_at }
//   POST /api/data/sync/            -> relit tous les onglets de la liste -> { tabs[{ name, ok, row_count, message }], saved, failed }
//   POST /api/data/<onglet>/sync/   -> relit un seul onglet (route gardée, non utilisée par le site)
//   GET    /api/sheet-config/       -> paramètres d'accès au Google Sheet (la clé privée n'est jamais renvoyée)
//   PUT    /api/sheet-config/       -> enregistre les paramètres saisis
//   DELETE /api/sheet-config/       -> revient aux valeurs du .env
//   GET    /api/sheet-config/tabs/  -> onglets du document : { mode, tabs[], selected[] }
//   GET    /api/profile/            -> réglages gardés en base : { asset_colors: { type: '#rrggbb' }, theme, updated_at }
//   PUT    /api/profile/            { theme } -> mode clair / sombre du profil ('light', 'dark', '' = système)
//   PUT    /api/profile/asset-colors/ { asset_colors } -> remplace les couleurs des types d'actifs ({} = par défaut)
//   (mode : 'service_account' = compte de service, 'public_link' = lien seul, 'none' = rien de configuré)
//   GET    /api/auth/me/            -> { configured, authenticated, user?: { email, name, picture }, first_login? }
//   POST   /api/auth/logout/        -> déconnexion
//   GET    /api/auth/google/picker-token/ -> { access_token, expires_in, api_key, app_id } (mode 3, compte connecté)
//   POST   /api/auth/google/drive/revoke/ -> retire l'accès aux feuilles (mode 3)
//   Les données (/api/data/) et la configuration (/api/sheet-config/) sont celles du compte connecté, sinon celles du site.
//   GET    /api/auth/google/start/?next=/page : connexion avec Google (navigation, pas fetch : voir lib/auth.js)
//   Avec une session ouverte, toute requête qui modifie (POST, PUT, DELETE) porte l'en-tête X-CSRFToken
//   (valeur du cookie csrftoken, posé par /api/auth/me/) ; sans lui, Django répond 403.
//   Erreurs : { "error": "message en français", "code": "code_stable", "params": {…}, "fields"?: { champ: message },
//             "field_codes"?: { champ: code } } avec le code 400, 404, 429 (trop rapproché) ou 502.
//   Le message affiché est traduit à partir de `code` (i18n, rubrique apiErrors) ; code inconnu : le message du serveur.

import { i18n, t } from '../i18n/index.js'

/** Message d'une erreur du serveur dans la langue active : traduit d'après son code, sinon le texte reçu. */
export function apiMessage(code, params = {}, fallback = '') {
  return code && i18n.global.te(`apiErrors.${code}`) ? t(`apiErrors.${code}`, params ?? {}) : fallback
}

/** Erreurs par champ d'un formulaire, traduites : { champ: message }. `labelOf(champ)` donne le nom du champ. */
function fieldMessages(fields = {}, codes = {}, labelOf = (field) => field) {
  return Object.fromEntries(
    Object.entries(fields).map(([field, message]) => {
      const code = codes?.[field]
      return [field, code ? apiMessage(`fields.${code}`, { label: labelOf(field) }, message) : message]
    }),
  )
}

export class ApiError extends Error {
  constructor(message, status = 0, fields = {}, code = '') {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fields = fields // erreurs par champ d'un formulaire (code 400), déjà traduites
  }
}

/** Jeton CSRF de Django (cookie csrftoken, lisible par le site). */
function csrfToken() {
  const match = typeof document !== 'undefined' ? document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/) : null
  return match ? decodeURIComponent(match[1]) : ''
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

// Configuration GoogleSheet que la page affiche : 'account' (compte connecté) ou 'site' (fixée par lib/auth.js).
// Envoyée avec chaque modification (en-tête X-Sheet-Scope) : si la session a changé entre-temps, le serveur refuse
// (session_expired, scope_changed) au lieu d'écrire dans une autre configuration, et la page se recharge.
let sheetScope = ''
export function setSheetScope(scope) {
  sheetScope = scope
}
const scopeHeader = () => (sheetScope ? { 'X-Sheet-Scope': sheetScope } : {})
const RELOAD_CODES = new Set(['session_expired', 'scope_changed'])

// `fieldLabel(champ)` : nom affiché d'un champ de formulaire, pour traduire les erreurs par champ
async function request(url, { fieldLabel, ...options } = {}) {
  const method = (options.method || 'GET').toUpperCase()
  const csrf = SAFE_METHODS.has(method) ? {} : { 'X-CSRFToken': csrfToken() }
  let response
  try {
    response = await fetch(url, {
      credentials: 'same-origin', // cookie de session
      ...options,
      headers: { Accept: 'application/json', ...csrf, ...(options.headers || {}) },
    })
  } catch {
    throw new ApiError(t('apiErrors.unreachable'), 0)
  }

  let body = null
  try {
    body = await response.json()
  } catch {
    // réponse non JSON : on garde le code HTTP
  }

  if (!response.ok) {
    if (RELOAD_CODES.has(body?.code) && typeof window !== 'undefined') setTimeout(() => window.location.reload(), 2500)
    const fallback = body?.error || t('apiErrors.http', { status: response.status })
    throw new ApiError(
      apiMessage(body?.code, body?.params, fallback),
      response.status,
      fieldMessages(body?.fields, body?.field_codes, fieldLabel),
      body?.code ?? '',
    )
  }
  if (body === null) {
    throw new ApiError(t('apiErrors.notJson'), response.status)
  }
  return body
}

export const listTables = () => request('/api/data/')

export const getTable = (name) => request(`/api/data/${encodeURIComponent(name)}/`)

export const syncAll = () => request('/api/data/sync/', { method: 'POST', headers: scopeHeader() })

export const getSheetConfig = () => request('/api/sheet-config/')

export const saveSheetConfig = (values) =>
  request('/api/sheet-config/', {
    fieldLabel: (field) => t(`sheetSettings.fields.${field}`),
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...scopeHeader() },
    body: JSON.stringify(values),
  })

export const resetSheetConfig = () => request('/api/sheet-config/', { method: 'DELETE', headers: scopeHeader() })

// Onglets du document (lien public ou compte de service) : { mode, tabs: [noms], selected: [noms] }
export const getSheetTabs = () => request('/api/sheet-config/tabs/')

// Enregistre seulement la liste des onglets à synchroniser ("portfolio, budget") ; renvoie la configuration
export const saveSyncTabs = (syncTabs) =>
  request('/api/sheet-config/tabs/', {
    fieldLabel: (field) => t(`sheetSettings.fields.${field}`),
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...scopeHeader() },
    body: JSON.stringify({ sync_tabs: syncTabs }),
  })

// Profil gardé en base (un seul pour le site tant qu'il n'y a pas de comptes)
export const getProfile = () => request('/api/profile/')

export const saveProfileAssetColors = (assetColors) =>
  request('/api/profile/asset-colors/', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ asset_colors: assetColors }),
  })

export const saveProfileTheme = (theme) =>
  request('/api/profile/', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ theme }),
  })

// Connexion (session Django, compte Google)
export const getSession = () => request('/api/auth/me/')

export const logoutSession = () => request('/api/auth/logout/', { method: 'POST' })

// Mode 3 de la page GoogleSheet : jeton court pour le sélecteur de Google, retrait de l'accès
export const getPickerToken = () => request('/api/auth/google/picker-token/')

export const revokeGoogleDrive = () => request('/api/auth/google/drive/revoke/', { method: 'POST' })

/** Autorise l'accès aux feuilles choisies (navigation vers Google, retour sur `next`). */
export const googleDriveStartUrl = (next) => `/api/auth/google/drive/start/?next=${encodeURIComponent(next)}`
