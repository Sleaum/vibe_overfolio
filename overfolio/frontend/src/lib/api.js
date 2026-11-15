// Appels à l'API Django. Chemins relatifs : nginx (ou le proxy de Vite en développement) les envoie au backend.
//
//   GET  /api/data/                 -> [{ name, row_count, synced_at }]
//   GET  /api/data/<onglet>/        -> { name, columns[], rows[{colonne: valeur}], row_count, synced_at }
//   POST /api/data/<onglet>/sync/   -> relit Google Sheets puis met la base à jour
//   Erreurs : { "error": "..." } avec le code 404, 429 (trop rapproché) ou 502.

export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message)
    this.name = 'ApiError'
    this.status = status
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
    throw new ApiError(body?.error || `Erreur HTTP ${response.status}`, response.status)
  }
  if (body === null) {
    throw new ApiError("Réponse inattendue du serveur (ce n'est pas du JSON).", response.status)
  }
  return body
}

export const listTables = () => request('/api/data/')

export const getTable = (name) => request(`/api/data/${encodeURIComponent(name)}/`)

export const syncTable = (name) =>
  request(`/api/data/${encodeURIComponent(name)}/sync/`, { method: 'POST' })
