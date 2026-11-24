// Date des positions (table `portfolio`), affichée dans l'en-tête à droite du titre Overfolio.
// La plus récente valeur de la colonne Date ; sans cette colonne, le jour de la dernière synchronisation.
// Chargée une fois à l'ouverture du site, puis rechargée après « Tout actualiser » (page GoogleSheet).
// La connexion et la déconnexion rechargent tout le site : la date suit le compte sans autre appel.

import { ref } from 'vue'
import { getTable } from './api.js'
import { findColumn, latestDate, rowsOf } from './aggregate.js'
import { toIsoDate } from './dates.js'

/** "AAAA-MM-JJ", ou '' (pas encore chargée, table absente ou sans date). */
export const portfolioDate = ref('')

let lastRequest = 0

export async function loadPortfolioDate() {
  const request = ++lastRequest // une réponse tardive ne doit pas écraser la plus récente
  try {
    const table = await getTable('portfolio')
    if (request !== lastRequest) return
    const column = findColumn(table.columns, ['Date'])
    portfolioDate.value = (column && latestDate(rowsOf(table), column)) || toIsoDate(table.synced_at) || ''
  } catch {
    // table absente (pas encore synchronisée) ou serveur injoignable : l'en-tête n'affiche pas de date
    if (request === lastRequest) portfolioDate.value = ''
  }
}
