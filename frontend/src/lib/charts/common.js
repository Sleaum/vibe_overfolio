// Éléments partagés par les spécifications de graphiques.

import { findColumn, latestDate, rowsOf } from '../aggregate.js'
import { t } from '../../i18n/index.js'
import { formatDateLong, formatDateTime } from '../format.js'

/**
 * Sous-titre « date des données » : la date la plus récente de la colonne Date si la table en a une,
 * sinon la date de la dernière synchronisation.
 * `key` : texte i18n avec {date} (par défaut « Données au {date}. »).
 */
export function dataSubtitle(table, key = 'subtitle.dataAsOf') {
  const dateColumn = findColumn(table?.columns, ['Date'])
  const latest = dateColumn ? latestDate(rowsOf(table), dateColumn) : ''
  if (latest) return t(key, { date: formatDateLong(latest) })
  if (table?.synced_at) return t('subtitle.syncedAt', { date: formatDateTime(table.synced_at) })
  return ''
}
