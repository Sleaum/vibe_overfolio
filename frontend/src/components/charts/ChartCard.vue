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
      <div
        v-if="status === 'loading'"
        role="status"
        class="flex h-72 items-center justify-center rounded-lg bg-wash text-ink-2 motion-safe:animate-pulse"
      >
        {{ t('chartUi.loading') }}
      </div>

      <div v-else-if="status === 'error'" role="alert" class="rounded-lg border border-danger-line bg-danger-wash p-5">
        <p class="font-semibold text-danger">
          {{ missingTable ? t('chartUi.missingTableTitle') : t('chartUi.loadErrorTitle') }}
        </p>
        <p class="mt-1 text-ink">
          {{
            missingTable
              ? t('chartUi.missingTableText', { table: spec.table })
              : error.message
          }}
        </p>
        <div class="mt-4 flex flex-wrap gap-3">
          <AppButton v-if="missingTable" :to="sheetLink" variant="secondary" size="sm">{{ t('chartUi.openSheet') }}</AppButton>
          <AppButton variant="secondary" size="sm" @click="reload">{{ t('chartUi.retry') }}</AppButton>
        </div>
      </div>

      <div v-else-if="status === 'problem'" role="alert" class="rounded-lg border border-danger-line bg-danger-wash p-5">
        <p class="font-semibold text-danger">{{ t('chartUi.problemTitle') }}</p>
        <p class="mt-1 text-ink">{{ model.problem }}</p>
        <p class="mt-3 text-sm text-ink-2">{{ t('chartUi.problemHint') }}</p>
      </div>

      <div
        v-else-if="status === 'empty'"
        class="flex h-56 flex-col items-center justify-center rounded-lg border border-dashed border-line-strong bg-wash px-6 text-center"
      >
        <p class="font-semibold text-ink">{{ t('chartUi.emptyTitle') }}</p>
        <p class="mt-1 max-w-md text-ink-2">{{ model.empty }}</p>
      </div>

      <template v-else>
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
      </template>
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
import { computed, ref } from 'vue'
import { DataError } from '../../lib/aggregate.js'
import { buildChart } from '../../lib/amounts.js'
import { formatDateTime } from '../../lib/format.js'
import AppButton from '../ui/AppButton.vue'
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

const model = computed(() => {
  if (!props.data) return null
  try {
    return buildChart(props.spec, props.data)
  } catch (err) {
    if (err instanceof DataError) return { problem: err.message }
    console.error(err)
    return { problem: t('chartUi.buildFailed', { message: err?.message ?? t('chartUi.unknownError') }) }
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
  props.data?.synced_at ? t('chartUi.tableSynced', { table: props.spec.table, date: formatDateTime(props.data.synced_at) }) : '',
)
</script>
