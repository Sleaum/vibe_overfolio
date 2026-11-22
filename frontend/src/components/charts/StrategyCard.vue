<!--
  Carte d'un anneau à deux niveaux (page Stratégie) : l'anneau, sa légende (nom, part, montant) et une version tableau.
  `chart` vient de lib/strategy.js. Les couleurs de l'anneau sont reprises par la légende : l'information n'est jamais
  portée par la couleur seule (noms et chiffres sont écrits, et le tableau donne tout le détail).
-->
<template>
  <section class="rounded-xl border border-line bg-paper shadow-soft" :aria-labelledby="titleId">
    <header class="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 border-b border-line px-4 py-4 sm:px-6">
      <div class="min-w-0">
        <h2 :id="titleId" class="text-h3 text-ink">{{ chart.title }}</h2>
        <p class="mt-1 text-sm text-ink-2">{{ chart.subtitle }}</p>
      </div>
      <SegmentedControl v-model="view" :options="VIEWS" :label="t('chartUi.displayOf', { title: chart.title })" />
    </header>

    <div class="p-4 sm:p-6">
      <DataTableView
        v-if="view === 'table'"
        :columns="chart.table.columns"
        :rows="chart.table.rows"
        :numeric="chart.table.numeric"
        :caption="t('chartUi.tableVersion', { title: chart.title })"
      />
      <template v-else>
        <BaseChart :option="option" :height="300" :label="chart.summary" />
        <ul class="mt-5 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2" :aria-label="t('chartUi.partsOf', { title: chart.title })">
          <li v-for="item in chart.legend" :key="item.name" class="flex items-start gap-2.5 py-1.5">
            <span class="mt-1.5 h-3 w-3 shrink-0 rounded-[3px]" :style="{ backgroundColor: item.color }" aria-hidden="true"></span>
            <span class="min-w-0">
              <span class="block break-words text-ink">{{ item.name }}</span>
              <span class="block text-sm tabular-nums text-ink-2">
                <span class="font-semibold text-ink">{{ item.share }}</span> · {{ item.amount }}
              </span>
            </span>
          </li>
        </ul>
        <p v-if="chart.detailTitle" class="mt-4 text-sm text-ink-3">
          {{ t('chartUi.ringsHint', { inner: chart.title, outer: chart.detailTitle }) }}
        </p>
      </template>
    </div>
  </section>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { computed, ref } from 'vue'
import { sunburstOption } from '../../lib/charts/sunburst.js'
import SegmentedControl from '../ui/SegmentedControl.vue'
import BaseChart from './BaseChart.vue'
import DataTableView from './DataTableView.vue'

const { t } = useI18n()

const props = defineProps({
  chart: { type: Object, required: true }, // un élément de `charts` renvoyé par buildStrategy
})

const VIEWS = [
  { value: 'chart', label: t('chartUi.chart') },
  { value: 'table', label: t('chartUi.table') },
]

const view = ref('chart')
const titleId = computed(() => `strategie-${props.chart.key}`)
const option = computed(() => sunburstOption(props.chart.categories, props.chart.total))
</script>
