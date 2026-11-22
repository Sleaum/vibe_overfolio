<!--
  Carte du monde de la page Strategy : chaque pays coloré selon le montant de tes actions dont la colonne Area désigne
  ce pays, la liste des pays dessous, et une version tableau (pays et actions). `map` vient de lib/strategy.js.
  Les frontières des pays ne sont chargées qu'ici (lib/charts/worldMap.js, loadWorldMap).
-->
<template>
  <section class="rounded-xl border border-line bg-paper shadow-soft" aria-labelledby="strategie-carte">
    <header class="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 border-b border-line px-4 py-4 sm:px-6">
      <div class="min-w-0">
        <h2 id="strategie-carte" class="text-h3 text-ink">{{ t('strategyMap.title') }}</h2>
        <p class="mt-1 text-sm text-ink-2">{{ subtitle }}</p>
      </div>
      <SegmentedControl v-model="view" :options="VIEWS" :label="t('chartUi.displayOf', { title: t('strategyMap.title') })" />
    </header>

    <div class="p-4 sm:p-6">
      <DataTableView
        v-if="view === 'table'"
        :columns="table.columns"
        :rows="table.rows"
        :numeric="table.numeric"
        :caption="t('chartUi.tableVersion', { title: t('strategyMap.title') })"
      />
      <template v-else>
        <p v-if="!map.countries.length" class="rounded-lg bg-wash p-6 text-center text-ink-2">{{ t('strategyMap.noCountry') }}</p>
        <template v-else>
          <div v-if="mapState === 'loading'" role="status" class="flex h-[420px] items-center justify-center rounded-lg bg-wash text-ink-2 motion-safe:animate-pulse">
            {{ t('strategyMap.loading') }}
          </div>
          <div v-else-if="mapState === 'error'" role="alert" class="flex h-[420px] flex-col items-center justify-center gap-3 rounded-lg bg-wash text-ink-2">
            <p>{{ t('strategyMap.loadError') }}</p>
            <AppButton variant="secondary" size="sm" @click="load">{{ t('chartUi.retry') }}</AppButton>
          </div>
          <BaseChart v-else :option="option" :height="420" :label="summary" />

          <!-- Pays, du plus gros au plus petit : la couleur n'est jamais la seule information -->
          <ul class="mt-5 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3" :aria-label="t('strategyMap.countries')">
            <li v-for="country in map.countries" :key="country.code" class="py-1.5">
              <span class="block text-ink">{{ country.name }}</span>
              <span class="block text-sm tabular-nums text-ink-2">
                <span class="font-semibold text-ink">{{ percent(country.share) }}</span> · {{ euro(country.value) }} ·
                {{ country.items.map((item) => item.name).join(', ') }}
              </span>
            </li>
          </ul>
        </template>
        <p v-if="map.unplaced.length" class="mt-4 text-sm text-ink-2">
          {{ t('strategyMap.unplaced', { list: map.unplaced.map((item) => `${item.name} (${percent(item.share)} · ${euro(item.value)})`).join(', ') }) }}
        </p>
        <p class="mt-2 text-sm text-ink-3">{{ t('strategyMap.source') }}</p>
      </template>
    </div>
  </section>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { computed, onMounted, ref } from 'vue'
import { loadWorldMap, worldMapOption } from '../../lib/charts/worldMap.js'
import { euro, percent } from '../../lib/format.js'
import AppButton from '../ui/AppButton.vue'
import SegmentedControl from '../ui/SegmentedControl.vue'
import BaseChart from './BaseChart.vue'
import DataTableView from './DataTableView.vue'

const { t } = useI18n()

const props = defineProps({
  map: { type: Object, required: true }, // champ `map` de buildStrategy
})

const VIEWS = [
  { value: 'chart', label: t('chartUi.chart') },
  { value: 'table', label: t('chartUi.table') },
]
const view = ref('chart')

// Frontières des pays : chargées à l'affichage de la carte
const mapState = ref('loading') // 'loading' | 'ready' | 'error'
async function load() {
  mapState.value = 'loading'
  try {
    await loadWorldMap()
    mapState.value = 'ready'
  } catch (err) {
    console.error(err)
    mapState.value = 'error'
  }
}
onMounted(load)

const option = computed(() => worldMapOption(props.map))

const subtitle = computed(() =>
  [euro(props.map.total), t('strategyMap.countryCount', { count: props.map.countries.length }, props.map.countries.length)].join(' · '),
)

const summary = computed(() => {
  const biggest = props.map.countries[0]
  return biggest
    ? t('strategyMap.a11y', {
        count: props.map.countries.length,
        total: euro(props.map.total),
        biggest: biggest.name,
        share: percent(biggest.share),
      })
    : ''
})

// Tableau : chaque pays, puis ses actions
const table = computed(() => ({
  columns: [t('strategyMap.country'), t('strategy.instrument'), t('chart.amount'), t('chart.shareOfTotal')],
  numeric: [false, false, true, true],
  rows: [
    ...props.map.countries.flatMap((country) => [
      [country.name, t('chart.total'), euro(country.value), percent(country.share)],
      ...country.items.map((item) => ['', item.name, euro(item.value), percent(item.value / props.map.total)]),
    ]),
    ...props.map.unplaced.map((item) => [item.name, t('strategyMap.notACountry'), euro(item.value), percent(item.share)]),
  ],
}))
</script>
