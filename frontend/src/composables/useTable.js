// Charge une table de l'API et expose son état (données, chargement, erreur).
// `source` : un nom de table, une ref ou une fonction qui renvoie le nom. Si le nom change, la table est rechargée.
// Pendant un rechargement de la même table, les anciennes données restent disponibles (pas de saut d'affichage).
// Montants dans la devise d'affichage (lib/displayCurrency.js), convertis par le serveur ; `raw: true` (page
// GoogleSheet) les garde en euros. `projection: true` (graphiques de Flow) : history avec le mois prochain, tiré de
// portfolio par le serveur (wealth/projection.py).

import { isRef, onMounted, ref, watch } from 'vue'
import { getTable } from '../lib/api.js'
import { DEFAULT_CURRENCY, displayCurrency } from '../lib/displayCurrency.js'

export function useTable(source, { immediate = true, raw = false, projection = false } = {}) {
  const read = () => (typeof source === 'function' ? source() : isRef(source) ? source.value : source)

  const data = ref(null)
  const loading = ref(false)
  const error = ref(null) // { message, status }
  let loadedName = null
  let lastRequest = 0

  async function reload() {
    const name = read()
    if (!name) return

    const request = ++lastRequest // une réponse tardive ne doit pas écraser la plus récente
    if (name !== loadedName) data.value = null
    loading.value = true
    error.value = null
    try {
      const currency = raw ? '' : displayCurrency.value
      const body = await getTable(name, currency === DEFAULT_CURRENCY ? '' : currency, { projection })
      if (request !== lastRequest) return
      data.value = body
      loadedName = name
    } catch (err) {
      if (request !== lastRequest) return
      data.value = null
      loadedName = null
      error.value = { message: err.message, status: err.status ?? 0 }
    } finally {
      if (request === lastRequest) loading.value = false
    }
  }

  if (typeof source === 'function' || isRef(source)) {
    watch(read, () => reload())
  }
  if (immediate) onMounted(reload)

  return { data, loading, error, reload }
}
