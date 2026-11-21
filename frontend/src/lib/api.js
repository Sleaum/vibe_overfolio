// Appels à l'API Django. Chemins relatifs : nginx (ou le proxy de Vite en développement) les envoie au backend.
//
//   GET  /api/data/                 -> [{ name, row_count, synced_at }]
//   GET  /api/data/<onglet>/        -> { name, columns[], rows[{colonne: valeur}], row_count, synced_at }
//   POST /api/data/sync/            -> relit tous les onglets de la liste -> { tabs[{ name, ok, row_count, message }], saved, failed }
//   POST /api/data/<onglet>/sync/   -> relit un seul onglet (route gardée, non utilisée par le site)
//   GET    /api/sheet-config/       -> paramètres d'accès au Google Sheet (la clé privée n'est jamais renvoyée)
//   PUT    /api/sheet-config/       -> enregistre les paramètres saisis
//   DELETE /api/sheet-config/       -> revient aux valeurs du .env
//   Erreurs : { "error": "...", "fields"?: { champ: message } } avec le code 400, 404, 429 (trop rapproché) ou 502.

export class ApiError extends Error {
  constructor(message, status = 0, fields = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fields = fields // erreurs par champ d'un formulaire (code 400)
  }
}

async function request(url, options = {}) {
  let response
  try {
    response = await fetch(url, {
      ...options,
      headers: { Accept: 'application/json', ...(options.headers || {}) },
    })
  } catch {
    throw new ApiError("Impossible de joindre le serveur. Vérifie que l'application est démarrée.", 0)
  }

  let body = null
  try {
    body = await response.json()
  } catch {
    // réponse non JSON : on garde le code HTTP
  }

  if (!response.ok) {
    throw new ApiError(body?.error || `Erreur HTTP ${response.status}`, response.status, body?.fields || {})
  }
  if (body === null) {
    throw new ApiError("Réponse inattendue du serveur (ce n'est pas du JSON).", response.status)
  }
  return body
}

export const listTables = () => request('/api/data/')

export const getTable = (name) => request(`/api/data/${encodeURIComponent(name)}/`)

export const syncAll = () => request('/api/data/sync/', { method: 'POST' })

export const getSheetConfig = () => request('/api/sheet-config/')

export const saveSheetConfig = (values) =>
  request('/api/sheet-config/', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(values),
  })

export const resetSheetConfig = () => request('/api/sheet-config/', { method: 'DELETE' })
