// Éléments partagés par les spécifications de graphiques.

import { findColumn, latestDate, rowsOf } from '../aggregate.js'
import { formatDateLong, formatDateTime } from '../format.js'

/**
 * Sous-titre « date des données » : la date la plus récente de la colonne Date si la table en a une,
 * sinon la date de la dernière synchronisation.
 */
export function dataSubtitle(table, prefix = 'Données au') {
  const dateColumn = findColumn(table?.columns, ['Date'])
  const latest = dateColumn ? latestDate(rowsOf(table), dateColumn) : ''
  if (latest) return `${prefix} ${formatDateLong(latest)}.`
  if (table?.synced_at) return `Synchronisé le ${formatDateTime(table.synced_at)}.`
  return ''
}
