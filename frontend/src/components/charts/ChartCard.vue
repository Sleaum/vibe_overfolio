<!--
  Carte d'un graphique pour une page qui en réunit plusieurs (Portfolio Flow) : titre, date des données,
  graphique ou tableau, et lien vers la page détaillée. Les données sont chargées par la page, une seule fois par table.
  Mêmes quatre états que ChartView : chargement, erreur, données inadaptées, aucune donnée.
-->
<template>
  <section class="rounded-xl border border-line bg-paper shadow-soft" :aria-labelledby="titleId">
    <header class="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-b border-line px-4 py-4 sm:px-6">
      <div class="min-w-0">
        <h2 :id="titleId" class="text-h3 text-ink">{{ spec.title }}</h2>
        <p class="mt-1 text-ink-2">{{ subtitle }}</p>
      </div>
      <SegmentedControl v-if="status === 'ready'" v-model="view" :options="VIEWS" :label="t('chartUi.display')" />
      <!-- Choix des devises (graphique Patrimoine par devise) -->
      <CurrencyPicker
        v-if="model?.currencies"
        class="w-full"
        :available="model.currencies.available"
        :selected="model.currencies.selected"
        :more="model.currencies.more"
        @changed="reload"
      />
      <!-- Périodes au choix (graphique de Snapshot, en jours) : pastilles, ajout et retrait -->
      <WindowsPicker
        v-if="spec.windows"
        class="w-full"
        :store="spec.windows.store"
        :format="spec.windows.format"
        :unit="spec.windows.unit"
        :testid="spec.windows.testid"
      />
    </header>

    <div class="p-4 sm:p-6">
      <PageState
        :status="status"
        :error="error"
        :missing-table="missingTable"
        :problem="model?.problem"
        :empty="model?.empty"
        :reload="reload"
        :table="spec.table"
        loading-height="h-72"
      >
        <DataTableView
          v-if="view === 'table'"
          :columns="model.table.columns"
          :rows="model.table.rows"
          :numeric="model.table.numeric"
          :caption="t('chartUi.tableVersion', { title: spec.title })"
        />
        <BaseChart
          v-else
          :option="model.option"
          :height="model.height"
          :min-width="spec.minWidth || 0"
          :label="model.summary"
        />
        <p v-if="model.note" class="mt-4 text-sm text-ink-2">{{ model.note }}</p>
      </PageState>
    </div>

    <footer class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-line px-4 py-3 text-sm sm:px-6">
      <span class="text-ink-3">{{ syncLabel }}</span>
      <router-link
        :to="{ name: 'ChartPage', params: { slug: spec.slug } }"
        class="font-medium text-accent underline underline-offset-2 hover:text-accent-hover"
      >
        {{ t('chartUi.explainLink') }}
      </router-link>
    </footer>
  </section>
</template>

<script setup>
import CurrencyPicker from './CurrencyPicker.vue'
import WindowsPicker from './WindowsPicker.vue'
import { useI18n } from 'vue-i18n'
import { computed, ref, toRef } from 'vue'
import { usePageModel } from '../../composables/usePageModel.js'
import { buildChart } from '../../lib/amounts.js'
import { formatDateTime } from '../../lib/format.js'
import PageState from '../PageState.vue'
import SegmentedControl from '../ui/SegmentedControl.vue'
import BaseChart from './BaseChart.vue'
import DataTableView from './DataTableView.vue'

const { t } = useI18n()

const props = defineProps({
  spec: { type: Object, required: true },
  data: { type: Object, default: null }, // table de l'API, null tant qu'elle n'est pas chargée
  error: { type: Object, default: null }, // { message, status }
  reload: { type: Function, default: () => {} },
})

const VIEWS = [
  { value: 'chart', label: t('chartUi.chart') },
  { value: 'table', label: t('chartUi.table') },
]

const view = ref('chart')
const titleId = computed(() => `carte-${props.spec.slug}`)

// La table est chargée par la page (une seule fois pour toutes ses cartes) et arrive en props
const table = { data: toRef(props, 'data'), error: toRef(props, 'error'), reload: () => props.reload() }
const { status, model, error, missingTable } = usePageModel({
  required: [{ name: 'chart', table }],
  failedKey: 'chartUi.buildFailed',
  build: ({ chart }) => buildChart(props.spec, chart),
})
const subtitle = computed(() => model.value?.subtitle || props.spec.summary)
const syncLabel = computed(() =>
  props.data?.synced_at ? t('chartUi.tableSynced', { table: props.spec.table, date: formatDateTime(props.data.synced_at) }) : '',
)
</script>
