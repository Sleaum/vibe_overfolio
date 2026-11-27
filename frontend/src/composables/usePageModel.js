// Tables d'une page (ou d'un graphique) et ce qu'elle en construit, avec l'état à afficher (components/PageState.vue).
//
//   const { status, model, error, missingTable, tables, reload } = usePageModel({
//     required: ['portfolio'],          // sans elles, pas de page
//     optional: ['history'],            // la page s'affiche aussi sans elles (table absente, erreur)
//     waitOptional: false,              // true : attendre leur réponse (ou leur erreur) avant de construire
//     build: ({ portfolio, history }) => buildSnapshot(portfolio, history), // données des tables (null si absente)
//   })
//
// Une table se donne par son nom, ou par un objet :
//   { name, source, ...options de useTable }  source : nom, ref ou fonction (rechargée quand le nom change)
//   { name, table: { data, error, reload } }  table déjà chargée ailleurs (ChartCard : la page la partage)
//
// status : 'loading', 'error' (une table obligatoire n'a pas pu être lue), 'problem' (les données ne conviennent pas :
// une DataError devient un message lisible, toute autre erreur est un bug, montré en console), 'empty' (rien à
// afficher : model.empty), 'ready'.

import { computed } from 'vue'
import { DataError } from '../lib/aggregate.js'
import { t } from '../i18n/index.js'
import { useTable } from './useTable.js'

function open(entry) {
  if (typeof entry === 'string') return [entry, useTable(entry)]
  const { name, table, source, ...options } = entry
  return [name, table ?? useTable(source ?? name, options)]
}

/**
 * @param {object} options
 * @param {Array} options.required tables obligatoires
 * @param {Array} [options.optional] tables facultatives
 * @param {boolean} [options.waitOptional] attendre la réponse des tables facultatives avant de construire
 * @param {(data: object) => object} options.build données -> modèle de la page ({ problem } ou { empty } possibles)
 * @param {string} [options.failedKey] texte i18n d'une erreur inattendue pendant la construction, avec {message}
 */
export function usePageModel({ required, optional = [], waitOptional = false, build, failedKey = 'page.buildFailed' }) {
  const requiredTables = required.map(open)
  const optionalTables = optional.map(open)
  const tables = Object.fromEntries([...requiredTables, ...optionalTables])

  const settled = (table) => Boolean(table.data.value || table.error.value)
  const failed = computed(() => requiredTables.map(([, table]) => table).find((table) => !table.data.value && table.error.value))

  const model = computed(() => {
    if (requiredTables.some(([, table]) => !table.data.value)) return null
    if (waitOptional && optionalTables.some(([, table]) => !settled(table))) return null
    const data = Object.fromEntries(Object.entries(tables).map(([name, table]) => [name, table.data.value ?? null]))
    try {
      return build(data)
    } catch (err) {
      if (err instanceof DataError) return { problem: err.message }
      console.error(err)
      return { problem: t(failedKey, { message: err?.message ?? t('chartUi.unknownError') }) }
    }
  })

  const status = computed(() => {
    if (failed.value) return 'error'
    if (!model.value) return 'loading'
    if (model.value.problem) return 'problem'
    if (model.value.empty) return 'empty'
    return 'ready'
  })

  /** Erreur de la table obligatoire qui n'a pas pu être lue : { message, status }, sinon null. */
  const error = computed(() => failed.value?.error.value ?? null)
  const missingTable = computed(() => error.value?.status === 404)

  /** Relit les tables obligatoires (bouton Réessayer). */
  const reload = () => Promise.all(requiredTables.map(([, table]) => table.reload()))

  return { status, model, error, missingTable, tables, reload }
}
