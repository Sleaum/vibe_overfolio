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
      <section class="col-span-12" :aria-label="spec.title">
        <div class="rounded-xl border border-line bg-paper shadow-soft">
          <!-- Réglages du graphique et bascule graphique / tableau -->
          <div
            v-if="controls.length || status === 'ready' || model?.currencies || spec.windows"
            class="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-line px-4 py-3 sm:px-6"
          >
            <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
              <CurrencyPicker
                v-if="model?.currencies"
                :available="model.currencies.available"
                :selected="model.currencies.selected"
                :more="model.currencies.more"
                @changed="reload"
              />
              <WindowsPicker
                v-if="spec.windows"
                :store="spec.windows.store"
                :format="spec.windows.format"
                :unit="spec.windows.unit"
                :testid="spec.windows.testid"
              />
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
              :label="t('chartUi.display')"
            />
          </div>

          <div class="p-4 sm:p-6">
            <!-- Chargement, erreur de l'API, données inadaptées, aucune donnée ; sinon le graphique ou le tableau -->
            <PageState
              :status="status"
              :error="error"
              :missing-table="missingTable"
              :problem="model?.problem"
              :empty="model?.empty"
              :reload="reload"
              :table="spec.table"
              empty-height="h-64"
              empty-link
            >
              <DataTableView
                v-if="view === 'table'"
                :columns="model.table.columns"
                :rows="model.table.rows"
                :numeric="model.table.numeric"
                :caption="t('chartUi.tableVersion', { title: spec.title })"
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
                <ul v-if="model.legend" class="divide-y divide-line" :aria-label="t('chartUi.amountsByPart')">
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
            </PageState>
          </div>

          <p v-if="syncLabel" class="border-t border-line px-4 py-3 text-sm text-ink-3 sm:px-6">
            {{ syncLabel }}
          </p>
        </div>
      </section>

      <!-- Explication et source des chiffres, sous le graphique -->
      <aside class="col-span-12 max-w-3xl">
        <h2 class="text-h3 text-ink">{{ t('chartUi.howToRead') }}</h2>
        <p v-for="paragraph in spec.explain" :key="paragraph" class="mt-3 text-ink-2">{{ paragraph }}</p>

        <h2 class="mt-8 text-h3 text-ink">{{ t('chartUi.whereFrom') }}</h2>
        <p class="mt-3 text-ink-2">{{ spec.source }}</p>
        <i18n-t keypath="chartUi.refreshHint" tag="p" scope="global" class="mt-3 text-sm text-ink-3">
          <template #sheet>
            <router-link to="/sheet" class="font-medium text-accent underline underline-offset-2 hover:text-accent-hover">
              GoogleSheet</router-link
            >
          </template>
        </i18n-t>
      </aside>
    </div>
  </article>
</template>

<script setup>
import CurrencyPicker from './CurrencyPicker.vue'
import WindowsPicker from './WindowsPicker.vue'
import { useI18n } from 'vue-i18n'
import { computed, reactive, ref } from 'vue'
import { findColumn } from '../../lib/aggregate.js'
import { buildChart } from '../../lib/amounts.js'
import { formatDateTime } from '../../lib/format.js'
import { usePageModel } from '../../composables/usePageModel.js'
import PageState from '../PageState.vue'
import SegmentedControl from '../ui/SegmentedControl.vue'
import BaseChart from './BaseChart.vue'
import DataTableView from './DataTableView.vue'

const { t } = useI18n()

const props = defineProps({
  spec: { type: Object, required: true },
})

const VIEWS = [
  { value: 'chart', label: t('chartUi.chart') },
  { value: 'table', label: t('chartUi.table') },
]

const values = reactive(Object.fromEntries((props.spec.controls ?? []).map((c) => [c.key, c.default])))
const view = ref('chart')

// La spécification transforme la table en option ECharts + tableau + textes (la table suit la spécification affichée)
const { status, model, error, missingTable, tables, reload } = usePageModel({
  required: [{ name: 'chart', source: () => props.spec.table, projection: Boolean(props.spec.projection) }],
  failedKey: 'chartUi.buildFailed',
  build: ({ chart }) => buildChart(props.spec, chart, { ...values }),
})
const { data } = tables.chart

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

const subtitle = computed(
  () => model.value?.subtitle || (status.value === 'loading' ? t('chartUi.loadingData') : props.spec.summary),
)

const syncLabel = computed(() =>
  data.value?.synced_at
    ? t('chartUi.tableSynced', { table: props.spec.table, date: formatDateTime(data.value.synced_at) })
    : '',
)
</script>
