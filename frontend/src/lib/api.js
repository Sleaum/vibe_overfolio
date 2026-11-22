// Appels à l'API Django. Chemins relatifs : nginx (ou le proxy de Vite en développement) les envoie au backend.
//
//   GET  /api/data/                 -> [{ name, row_count, synced_at }]
//   GET  /api/data/<onglet>/        -> { name, columns[], rows[{colonne: valeur}], row_count, synced_at }
//   POST /api/data/sync/            -> relit tous les onglets de la liste -> { tabs[{ name, ok, row_count, message }], saved, failed }
//   POST /api/data/<onglet>/sync/   -> relit un seul onglet (route gardée, non utilisée par le site)
//   GET    /api/sheet-config/       -> paramètres d'accès au Google Sheet (la clé privée n'est jamais renvoyée)
//   PUT    /api/sheet-config/       -> enregistre les paramètres saisis
//   DELETE /api/sheet-config/       -> revient aux valeurs du .env
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

// `fieldLabel(champ)` : nom affiché d'un champ de formulaire, pour traduire les erreurs par champ
async function request(url, { fieldLabel, ...options } = {}) {
  let response
  try {
    response = await fetch(url, {
      ...options,
      headers: { Accept: 'application/json', ...(options.headers || {}) },
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

export const syncAll = () => request('/api/data/sync/', { method: 'POST' })

export const getSheetConfig = () => request('/api/sheet-config/')

export const saveSheetConfig = (values) =>
  request('/api/sheet-config/', {
    fieldLabel: (field) => t(`sheetSettings.fields.${field}`),
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(values),
  })

export const resetSheetConfig = () => request('/api/sheet-config/', { method: 'DELETE' })
