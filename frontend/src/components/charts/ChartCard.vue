<!--
  Carte d'un graphique pour une page qui en réunit plusieurs (Portfolio Flow) : titre, date des données,
  graphique ou tableau, et lien vers la page détaillée. Les données sont chargées par la page, une seule fois par table.
  Mêmes quatre états que ChartView : chargement, erreur, données inadaptées, aucune donnée.
-->
<template>
  <section class="rounded-xl border border-line bg-white shadow-soft" :aria-labelledby="titleId">
    <header class="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-b border-line px-4 py-4 sm:px-6">
      <div class="min-w-0">
        <h2 :id="titleId" class="text-h3 text-ink">{{ spec.title }}</h2>
        <p class="mt-1 text-ink-2">{{ subtitle }}</p>
      </div>
      <SegmentedControl v-if="status === 'ready'" v-model="view" :options="VIEWS" label="Affichage" />
    </header>

    <div class="p-4 sm:p-6">
      <div
        v-if="status === 'loading'"
        role="status"
        class="flex h-72 items-center justify-center rounded-lg bg-wash text-ink-2 motion-safe:animate-pulse"
      >
        Chargement du graphique…
      </div>

      <div v-else-if="status === 'error'" role="alert" class="rounded-lg border border-danger-line bg-danger-wash p-5">
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
          <AppButton v-if="missingTable" :to="sheetLink" variant="secondary" size="sm">Ouvrir la page GoogleSheet</AppButton>
          <AppButton variant="secondary" size="sm" @click="reload">Réessayer</AppButton>
        </div>
      </div>

      <div v-else-if="status === 'problem'" role="alert" class="rounded-lg border border-danger-line bg-danger-wash p-5">
        <p class="font-semibold text-danger">Les données ne correspondent pas à ce graphique</p>
        <p class="mt-1 text-ink">{{ model.problem }}</p>
        <p class="mt-3 text-sm text-ink-2">Compare avec les noms de colonnes de la page GoogleSheet.</p>
      </div>

      <div
        v-else-if="status === 'empty'"
        class="flex h-56 flex-col items-center justify-center rounded-lg border border-dashed border-line-strong bg-wash px-6 text-center"
      >
        <p class="font-semibold text-ink">Pas de données à afficher</p>
        <p class="mt-1 max-w-md text-ink-2">{{ model.empty }}</p>
      </div>

      <template v-else>
        <DataTableView
          v-if="view === 'table'"
          :columns="model.table.columns"
          :rows="model.table.rows"
          :numeric="model.table.numeric"
          :caption="`${spec.title}, version tableau`"
        />
        <BaseChart
          v-else
          :option="model.option"
          :height="model.height"
          :min-width="spec.minWidth || 0"
          :label="model.summary"
        />
        <p v-if="model.note" class="mt-4 text-sm text-ink-2">{{ model.note }}</p>
      </template>
    </div>

    <footer class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-line px-4 py-3 text-sm sm:px-6">
      <span class="text-ink-3">{{ syncLabel }}</span>
      <router-link
        :to="{ name: 'ChartPage', params: { slug: spec.slug } }"
        class="font-medium text-accent underline underline-offset-2 hover:text-accent-hover"
      >
        Explication et source des chiffres
      </router-link>
    </footer>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import { DataError } from '../../lib/aggregate.js'
import { formatDateTime } from '../../lib/format.js'
import AppButton from '../ui/AppButton.vue'
import SegmentedControl from '../ui/SegmentedControl.vue'
import BaseChart from './BaseChart.vue'
import DataTableView from './DataTableView.vue'

const props = defineProps({
  spec: { type: Object, required: true },
  data: { type: Object, default: null }, // table de l'API, null tant qu'elle n'est pas chargée
  error: { type: Object, default: null }, // { message, status }
  reload: { type: Function, default: () => {} },
})

const VIEWS = [
  { value: 'chart', label: 'Graphique' },
  { value: 'table', label: 'Tableau' },
]

const view = ref('chart')
const titleId = computed(() => `carte-${props.spec.slug}`)

const model = computed(() => {
  if (!props.data) return null
  try {
    return props.spec.build(props.data, {})
  } catch (err) {
    if (err instanceof DataError) return { problem: err.message }
    console.error(err)
    return { problem: `Le graphique n’a pas pu être construit (${err?.message ?? 'erreur inconnue'}).` }
  }
})

const status = computed(() => {
  if (!props.data) return props.error ? 'error' : 'loading'
  if (!model.value) return 'loading'
  if (model.value.problem) return 'problem'
  if (model.value.empty) return 'empty'
  return 'ready'
})

const missingTable = computed(() => props.error?.status === 404)
const sheetLink = computed(() => ({ path: '/sheet', query: { onglet: props.spec.table } }))
const subtitle = computed(() => model.value?.subtitle || props.spec.summary)
const syncLabel = computed(() =>
  props.data?.synced_at ? `Table ${props.spec.table} synchronisée le ${formatDateTime(props.data.synced_at)}.` : '',
)
</script>
