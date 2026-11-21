<!--
  Page complète d'un graphique, pilotée par sa spécification (lib/charts/*.js) :
  titre, sous-titre avec la date des données, graphique (ou son tableau), explication et source des chiffres.
  Gère les quatre états : chargement, erreur, données inadaptées, aucune donnée.
-->
<template>
  <article>
    <header class="max-w-3xl">
      <h1 class="text-h2 text-ink">{{ spec.title }}</h1>
      <p class="mt-3 text-lead text-ink-2" aria-live="polite">{{ subtitle }}</p>
    </header>

    <div class="mt-10 grid grid-cols-12 gap-y-10 lg:gap-x-8">
      <section class="col-span-12 lg:col-span-8" :aria-label="spec.title">
        <div class="rounded-xl border border-line bg-white shadow-soft">
          <!-- Réglages du graphique et bascule graphique / tableau -->
          <div
            v-if="controls.length || status === 'ready'"
            class="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-line px-4 py-3 sm:px-6"
          >
            <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
              <template v-for="control in controls" :key="control.key">
                <span class="text-sm text-ink-2">{{ control.label }}</span>
                <SegmentedControl
                  v-model="values[control.key]"
                  :options="control.options"
                  :label="control.label"
                />
              </template>
            </div>
            <SegmentedControl
              v-if="status === 'ready'"
              v-model="view"
              class="ml-auto"
              :options="VIEWS"
              label="Affichage"
            />
          </div>

          <div class="p-4 sm:p-6">
            <!-- Chargement -->
            <div
              v-if="status === 'loading'"
              role="status"
              class="flex h-80 items-center justify-center rounded-lg bg-wash text-ink-2 motion-safe:animate-pulse"
            >
              Chargement du graphique…
            </div>

            <!-- Erreur de l'API -->
            <div
              v-else-if="status === 'error'"
              role="alert"
              class="rounded-lg border border-danger-line bg-danger-wash p-5"
            >
              <p class="font-semibold text-danger">
                {{ missingTable ? 'Cette table n’est pas encore dans la base' : 'Impossible de charger les données' }}
              </p>
              <p class="mt-1 text-ink">
                {{
                  missingTable
                    ? `La table « ${spec.table} » n’a pas encore été synchronisée depuis Google Sheets.`
                    : error.message
                }}
              </p>
              <div class="mt-4 flex flex-wrap gap-3">
                <AppButton v-if="missingTable" :to="sheetLink" variant="secondary" size="sm">
                  Ouvrir la page GoogleSheet
                </AppButton>
                <AppButton variant="secondary" size="sm" @click="reload">Réessayer</AppButton>
              </div>
            </div>

            <!-- Colonnes manquantes ou données inadaptées -->
            <div
              v-else-if="status === 'problem'"
              role="alert"
              class="rounded-lg border border-danger-line bg-danger-wash p-5"
            >
              <p class="font-semibold text-danger">Les données ne correspondent pas à ce graphique</p>
              <p class="mt-1 text-ink">{{ model.problem }}</p>
              <p class="mt-3 text-sm text-ink-2">Compare avec les noms de colonnes de la page GoogleSheet.</p>
            </div>

            <!-- Aucune donnée -->
            <div
              v-else-if="status === 'empty'"
              class="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed border-line-strong bg-wash px-6 text-center"
            >
              <p class="font-semibold text-ink">Pas de données à afficher</p>
              <p class="mt-1 max-w-md text-ink-2">{{ model.empty }}</p>
              <AppButton :to="sheetLink" variant="secondary" size="sm" class="mt-4">
                Ouvrir la page GoogleSheet
              </AppButton>
            </div>

            <!-- Graphique ou tableau -->
            <template v-else>
              <DataTableView
                v-if="view === 'table'"
                :columns="model.table.columns"
                :rows="model.table.rows"
                :numeric="model.table.numeric"
                :caption="`${spec.title}, version tableau`"
              />
              <div
                v-else
                :class="model.legend ? 'grid items-center gap-8 md:grid-cols-[minmax(0,280px)_minmax(0,1fr)]' : ''"
              >
                <BaseChart
                  :option="model.option"
                  :height="model.height"
                  :min-width="spec.minWidth || 0"
                  :label="model.summary"
                />
                <ul v-if="model.legend" class="divide-y divide-line" aria-label="Montants par part">
                  <li v-for="item in model.legend" :key="item.name" class="flex items-center gap-3 py-2.5">
                    <span
                      class="h-3 w-3 shrink-0 rounded-[3px]"
                      :style="{ backgroundColor: item.color }"
                      aria-hidden="true"
                    ></span>
                    <span class="min-w-0 flex-1 text-ink">{{ item.name }}</span>
                    <span class="shrink-0 text-right">
                      <span class="block whitespace-nowrap font-semibold tabular-nums text-ink">{{ item.amount }}</span>
                      <span class="block whitespace-nowrap text-sm tabular-nums text-ink-2">{{ item.share }}</span>
                    </span>
                  </li>
                </ul>
              </div>
              <p v-if="model.note" class="mt-4 text-sm text-ink-2">{{ model.note }}</p>
            </template>
          </div>

          <p v-if="syncLabel" class="border-t border-line px-4 py-3 text-sm text-ink-3 sm:px-6">
            {{ syncLabel }}
          </p>
        </div>
      </section>

      <!-- Explication et source des chiffres -->
      <aside class="col-span-12 lg:col-span-4">
        <h2 class="text-h3 text-ink">Comment lire ce graphique</h2>
        <p v-for="paragraph in spec.explain" :key="paragraph" class="mt-3 text-ink-2">{{ paragraph }}</p>

        <h2 class="mt-8 text-h3 text-ink">D’où viennent les chiffres</h2>
        <p class="mt-3 text-ink-2">{{ spec.source }}</p>
        <p class="mt-3 text-sm text-ink-3">
          Pour mettre à jour les données depuis Google Sheets, utilise le bouton Tout actualiser de la page
          <router-link to="/sheet" class="font-medium text-accent underline underline-offset-2 hover:text-accent-hover">
            GoogleSheet</router-link
          >.
        </p>
      </aside>
    </div>
  </article>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { DataError, findColumn } from '../../lib/aggregate.js'
import { formatDateTime } from '../../lib/format.js'
import { useTable } from '../../composables/useTable.js'
import AppButton from '../ui/AppButton.vue'
import SegmentedControl from '../ui/SegmentedControl.vue'
import BaseChart from './BaseChart.vue'
import DataTableView from './DataTableView.vue'

const props = defineProps({
  spec: { type: Object, required: true },
})

const VIEWS = [
  { value: 'chart', label: 'Graphique' },
  { value: 'table', label: 'Tableau' },
]

const values = reactive(Object.fromEntries((props.spec.controls ?? []).map((c) => [c.key, c.default])))
const view = ref('chart')

const { data, error, reload } = useTable(() => props.spec.table)

// Réglages affichés une fois les colonnes connues. Une option liée à une colonne absente de la table est masquée,
// et un réglage qui n'a plus qu'un choix disparaît (il ne servirait à rien).
const controls = computed(() => {
  const columns = data.value?.columns
  if (!columns) return []
  return (props.spec.controls ?? [])
    .map((control) => ({
      ...control,
      options: control.options.filter((option) => !option.column || findColumn(columns, [option.column])),
    }))
    .filter((control) => control.options.length > 1)
})

// La spécification transforme la table en option ECharts + tableau + textes.
// Une DataError (colonne absente…) devient un message lisible ; toute autre erreur est un bug à voir en console.
const model = computed(() => {
  if (!data.value) return null
  try {
    return props.spec.build(data.value, { ...values })
  } catch (err) {
    if (err instanceof DataError) return { problem: err.message }
    console.error(err)
    return { problem: `Le graphique n’a pas pu être construit (${err?.message ?? 'erreur inconnue'}).` }
  }
})

const status = computed(() => {
  if (!data.value) return error.value ? 'error' : 'loading'
  if (!model.value) return 'loading'
  if (model.value.problem) return 'problem'
  if (model.value.empty) return 'empty'
  return 'ready'
})

const missingTable = computed(() => error.value?.status === 404)

// La page GoogleSheet s'ouvre directement sur l'onglet de ce graphique, prêt à être actualisé
const sheetLink = computed(() => ({ path: '/sheet', query: { onglet: props.spec.table } }))

const subtitle = computed(
  () => model.value?.subtitle || (status.value === 'loading' ? 'Chargement des données…' : props.spec.summary),
)

const syncLabel = computed(() =>
  data.value?.synced_at
    ? `Table ${props.spec.table} synchronisée le ${formatDateTime(data.value.synced_at)}.`
    : '',
)
</script>
