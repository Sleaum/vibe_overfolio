<!--
  Page « Models » (/modeles), à part comme Simulation : les grands portefeuilles modèles (lazy portfolios).
  1. Ton patrimoine face aux modèles : ta répartition par type d'actif (table portfolio, actifs bruts) et les trois
     modèles les plus proches, comparés par famille (lib/models.js). Facultatif : sans portfolio, la page s'affiche quand même.
  2. Les portefeuilles : un tableau à partir de 1280 px, une carte par portefeuille en dessous. Filtre par famille.
     Dessin (PortfolioIcon.vue), créateur (lien Wikipédia dans la langue du site s'il existe), objectif, explication,
     camembert ECharts (lib/charts/modelPie.js : nom de l'actif sur chaque part, tout le détail au survol) aux couleurs
     des types d'actifs, familles cochées à droite. Les petits camemberts de la comparaison restent en SVG (MiniPie.vue).
  3. Les répliquer en France : PEA, CTO, assurance-vie, et où loger chaque brique.
  Données et calculs dans lib/models.js ; textes dans la rubrique modelsPage des fichiers de langue.
-->
<template>
  <div class="page-container py-12 sm:py-16">
    <header class="max-w-3xl">
      <h1 class="text-h2 text-ink">{{ t('pages.models') }}</h1>
      <p class="mt-3 text-lead text-ink-2">{{ t('modelsPage.lead') }}</p>
      <p class="mt-2 text-sm text-ink-3">{{ t('modelsPage.disclaimer') }}</p>
    </header>

    <!-- 1. Ton patrimoine face aux modèles -->
    <section aria-labelledby="titre-comparaison" class="mt-10 rounded-xl border border-line bg-paper shadow-soft">
      <div class="border-b border-line px-4 py-4 sm:px-6">
        <h2 id="titre-comparaison" class="text-h3 text-ink">{{ t('modelsPage.compare.title') }}</h2>
        <p class="mt-1 text-sm text-ink-2">{{ t('modelsPage.compare.lead') }}</p>
      </div>

      <div v-if="!portfolio.data.value && !portfolio.error.value" role="status" class="m-4 h-40 rounded-lg bg-wash motion-safe:animate-pulse sm:m-6">
        <span class="sr-only">{{ t('modelsPage.compare.loading') }}</span>
      </div>

      <div v-else-if="!user" class="px-4 py-6 sm:px-6">
        <p class="text-ink-2">{{ t('modelsPage.compare.noData') }}</p>
        <AppButton class="mt-3" :to="{ path: '/sheet', query: { onglet: 'portfolio' } }" variant="secondary" size="sm">
          {{ t('chartUi.openSheet') }}
        </AppButton>
      </div>

      <div v-else class="grid gap-8 p-4 sm:p-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div class="flex flex-wrap items-center gap-6">
          <MiniPie :slices="userSlices" :size="132" />
          <ul class="min-w-0 flex-1 space-y-1.5 text-sm" :aria-label="t('modelsPage.compare.yours')">
            <li v-for="slice in userSlices" :key="slice.label" class="flex items-center gap-2">
              <span class="h-2.5 w-2.5 shrink-0 rounded-sm" :style="{ backgroundColor: slice.color }" aria-hidden="true"></span>
              <span class="min-w-0 flex-1 truncate text-ink">{{ slice.label }}</span>
              <span class="tabular-nums text-ink-2">{{ formatDecimal(slice.value) }} %</span>
            </li>
          </ul>
        </div>

        <div>
          <h3 class="text-sm font-semibold text-ink">{{ t('modelsPage.compare.closest') }}</h3>
          <ol class="mt-3 space-y-3">
            <li v-for="(item, index) in closest" :key="item.model.key" class="flex items-center gap-3">
              <span class="w-4 text-sm tabular-nums text-ink-3">{{ index + 1 }}</span>
              <PortfolioIcon :model="item.model.key" :label="t(`modelsPage.models.${item.model.key}.icon`)" :size="32" />
              <span class="min-w-0 flex-1">
                <span class="block font-semibold text-ink">{{ item.model.name }}</span>
                <span class="block text-sm text-ink-2">{{ t('modelsPage.compare.gap', { points: Math.round(item.gap) }) }}</span>
              </span>
              <MiniPie :slices="slicesOf(item.model)" :size="40" />
            </li>
          </ol>
          <p class="mt-4 text-sm text-ink-3">
            {{ t('modelsPage.compare.how') }}
            <template v-if="user.shares.other > 0.005">{{ ' ' + t('modelsPage.compare.other', { share: percent(user.shares.other) }) }}</template>
          </p>
        </div>
      </div>
    </section>

    <!-- 2. Les portefeuilles -->
    <section aria-labelledby="titre-modeles" class="mt-14">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <h2 id="titre-modeles" class="text-h3 text-ink">{{ t('modelsPage.listTitle') }}</h2>
        <div class="-mx-1 max-w-full overflow-x-auto px-1 [&_button]:whitespace-nowrap">
          <SegmentedControl v-model="filter" :options="filterOptions" :label="t('modelsPage.filterLabel')" />
        </div>
      </div>

      <!-- Légende des couleurs, par famille -->
      <div class="mt-5 grid gap-x-8 gap-y-2 text-xs text-ink-2 sm:grid-cols-3">
        <div v-for="group in legend" :key="group.family" class="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span class="font-semibold text-ink">{{ t(`modelsPage.legend.${group.family}`) }}</span>
          <span v-for="item in group.items" :key="item.key" class="inline-flex items-center gap-1.5">
            <span class="h-2.5 w-2.5 rounded-sm" :style="{ backgroundColor: item.color }" aria-hidden="true"></span>
            {{ item.label }}
          </span>
        </div>
      </div>

      <!-- Grand écran : tableau -->
      <div class="mt-6 hidden rounded-xl border border-line bg-paper shadow-soft xl:block">
        <table class="w-full table-fixed border-collapse text-sm">
          <colgroup>
            <col class="w-14" />
            <col class="w-32" />
            <col class="w-36" />
            <col class="w-28" />
            <col />
            <col class="w-60" />
            <col v-for="style in STYLES" :key="style" class="w-14" />
          </colgroup>
          <thead>
            <tr class="border-b border-line-strong text-left text-xs font-semibold text-ink-3">
              <th scope="col" class="px-3 py-3"><span class="sr-only">{{ t('modelsPage.columns.icon') }}</span></th>
              <th scope="col" class="px-2 py-3">{{ t('modelsPage.columns.portfolio') }}</th>
              <th scope="col" class="px-2 py-3">{{ t('modelsPage.columns.creator') }}</th>
              <th scope="col" class="px-2 py-3">{{ t('modelsPage.columns.goal') }}</th>
              <th scope="col" class="px-2 py-3">{{ t('modelsPage.columns.detail') }}</th>
              <th scope="col" class="px-2 py-3 text-center">{{ t('modelsPage.columns.allocation') }}</th>
              <th
                v-for="(style, i) in STYLES"
                :key="style"
                scope="col"
                class="px-1 py-3 text-center"
                :class="i === 0 ? 'border-l border-line' : ''"
              >
                {{ t(`modelsPage.styles.${style}`) }}
              </th>
            </tr>
          </thead>
          <tbody v-for="group in groups" :key="group.key">
            <tr>
              <th :colspan="6 + STYLES.length" scope="colgroup" class="border-b border-line bg-wash px-3 py-2 text-left text-xs font-semibold text-ink-2">
                {{ t(`modelsPage.groups.${group.key}`) }}
              </th>
            </tr>
            <tr v-for="model in group.models" :key="model.key" class="border-b border-line last:border-b-0">
              <td class="px-3 py-3"><PortfolioIcon :model="model.key" :label="t(`modelsPage.models.${model.key}.icon`)" /></td>
              <th scope="row" class="px-2 py-3 text-left font-semibold text-ink">{{ model.name }}</th>
              <td class="px-2 py-3"><Creator :model="model" /></td>
              <td class="px-2 py-3 text-ink">{{ t(`modelsPage.models.${model.key}.goal`) }}</td>
              <td class="px-2 py-3 text-ink-2">{{ t(`modelsPage.models.${model.key}.detail`) }}</td>
              <td class="px-1 py-1"><BaseChart :option="pieOptions[model.key]" :height="170" :label="pieLabel(model)" /></td>
              <td
                v-for="(style, i) in STYLES"
                :key="style"
                class="px-1 py-3 text-center text-ink-2"
                :class="i === 0 ? 'border-l border-line' : ''"
              >
                <template v-if="model.styles.includes(style)">
                  <svg viewBox="0 0 24 24" class="mx-auto h-4 w-4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>
                  <span class="sr-only">{{ t('modelsPage.yes') }}</span>
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Sous 1280 px : une carte par portefeuille -->
      <div v-for="group in groups" :key="`m-${group.key}`" class="xl:hidden">
        <h3 class="mt-8 text-sm font-semibold text-ink-2">{{ t(`modelsPage.groups.${group.key}`) }}</h3>
        <ul class="mt-3 grid gap-4 md:grid-cols-2">
          <li v-for="model in group.models" :key="model.key" class="rounded-xl border border-line bg-paper p-4 shadow-soft">
            <div class="flex items-start gap-3">
              <PortfolioIcon :model="model.key" :label="t(`modelsPage.models.${model.key}.icon`)" />
              <div class="min-w-0 flex-1">
                <p class="font-semibold text-ink">{{ model.name }}</p>
                <div class="text-sm"><Creator :model="model" /></div>
              </div>
            </div>
            <p class="mt-3 text-sm font-medium text-ink">{{ t(`modelsPage.models.${model.key}.goal`) }}</p>
            <p class="mt-1 text-sm text-ink-2">{{ t(`modelsPage.models.${model.key}.detail`) }}</p>
            <BaseChart class="mt-2" :option="pieOptions[model.key]" :height="190" :label="pieLabel(model)" />
            <ul class="mt-2 flex flex-wrap gap-1.5" :aria-label="t('modelsPage.columns.styles')">
              <li v-for="style in model.styles" :key="style" class="rounded-md border border-line bg-wash px-2 py-0.5 text-xs text-ink-2">
                {{ t(`modelsPage.styles.${style}`) }}
              </li>
            </ul>
          </li>
        </ul>
      </div>
      <p v-if="!groups.length" class="mt-6 text-ink-2">{{ t('modelsPage.noMatch') }}</p>
    </section>

    <!-- 3. Les répliquer en France -->
    <section aria-labelledby="titre-france" class="mt-14">
      <h2 id="titre-france" class="text-h3 text-ink">{{ t('modelsPage.france.title') }}</h2>
      <p class="mt-2 max-w-3xl text-ink-2">{{ t('modelsPage.france.lead') }}</p>

      <ul class="mt-6 grid gap-4 md:grid-cols-3">
        <li v-for="envelope in ENVELOPES" :key="envelope" class="rounded-xl border border-line bg-paper p-5 shadow-soft">
          <h3 class="font-semibold text-ink">{{ t(`modelsPage.france.envelopes.${envelope}.name`) }}</h3>
          <p class="mt-2 text-sm text-ink-2">{{ t(`modelsPage.france.envelopes.${envelope}.holds`) }}</p>
          <p class="mt-3 text-sm text-ink">{{ t(`modelsPage.france.envelopes.${envelope}.tax`) }}</p>
        </li>
      </ul>

      <div class="mt-6 overflow-x-auto rounded-xl border border-line bg-paper shadow-soft">
        <table class="w-full min-w-[40rem] border-collapse text-sm">
          <caption class="sr-only">{{ t('modelsPage.france.bricksTitle') }}</caption>
          <thead>
            <tr class="border-b border-line-strong text-left text-xs font-semibold text-ink-3">
              <th scope="col" class="px-4 py-3">{{ t('modelsPage.france.brick') }}</th>
              <th scope="col" class="px-4 py-3">{{ t('modelsPage.france.where') }}</th>
              <th scope="col" class="px-4 py-3">{{ t('modelsPage.france.examples') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="brick in BRICKS" :key="brick" class="border-b border-line last:border-b-0">
              <th scope="row" class="px-4 py-2.5 text-left font-medium text-ink">
                <span class="flex items-center gap-2">
                  <span class="h-2.5 w-2.5 shrink-0 rounded-sm" :style="{ backgroundColor: colors.classes[brick] }" aria-hidden="true"></span>
                  {{ t(`modelsPage.classes.${brick}`) }}
                </span>
              </th>
              <td class="px-4 py-2.5 text-ink">{{ t(`modelsPage.france.bricks.${brick}.where`) }}</td>
              <td class="px-4 py-2.5 text-ink-2">{{ t(`modelsPage.france.bricks.${brick}.examples`) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <ul class="mt-6 max-w-3xl list-disc space-y-1.5 pl-5 text-sm text-ink-2">
        <li v-for="tip in tList('modelsPage.france.tips')" :key="tip">{{ tip }}</li>
      </ul>
    </section>
  </div>
</template>

<script setup>
import { computed, defineComponent, h, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AppButton from '../components/ui/AppButton.vue'
import SegmentedControl from '../components/ui/SegmentedControl.vue'
import MiniPie from '../components/models/MiniPie.vue'
import BaseChart from '../components/charts/BaseChart.vue'
import PortfolioIcon from '../components/models/PortfolioIcon.vue'
import { useTable } from '../composables/useTable.js'
import { tList } from '../i18n/index.js'
import { capitalize, formatDecimal, percent } from '../lib/format.js'
import { GROUPS, LEGEND, MODELS, STYLES, closestModels, modelColors, personUrl, userAllocation } from '../lib/models.js'
import { modelPieOption } from '../lib/charts/modelPie.js'
import { assignAssetColors } from '../lib/palette.js'

const { t, locale } = useI18n()

const ENVELOPES = ['pea', 'cto', 'lifeInsurance']
const BRICKS = ['equity', 'smallValue', 'bondsLong', 'bondsMid', 'cash', 'gold', 'commodities', 'trend', 'longVol', 'realEstate', 'bondsIndexed']

// Couleurs des classes : celles des types d'actifs (réactif : suit les couleurs choisies dans le menu de Charts)
const colors = computed(() => modelColors())

/** Parts d'un modèle pour son camembert. */
function slicesOf(model) {
  return model.allocation.map(([cls, value, label]) => ({
    label: t(label ? `modelsPage.slices.${label}` : `modelsPage.classes.${cls}`),
    value,
    color: colors.value.classes[cls],
  }))
}

// Grands camemberts de la colonne Répartition et des cartes (refaits si une couleur ou la langue change)
const pieOptions = computed(() => Object.fromEntries(MODELS.map((model) => [model.key, modelPieOption(model, colors.value.classes)])))

/** Texte du camembert pour les lecteurs d'écran : toutes les parts. */
function pieLabel(model) {
  return slicesOf(model)
    .map((slice) => t('modelsPage.sliceTitle', { label: slice.label, value: formatDecimal(slice.value) }))
    .join(', ')
}

const legend = computed(() =>
  LEGEND.map((group) => ({
    family: group.family,
    items: group.classes.map((key) => ({ key, label: t(`modelsPage.classes.${key}`), color: colors.value.classes[key] })),
  })),
)

// Filtre par famille
const filter = ref('all')
const filterOptions = computed(() => [
  { value: 'all', label: t('modelsPage.all') },
  ...STYLES.map((style) => ({ value: style, label: t(`modelsPage.styles.${style}`) })),
])
const groups = computed(() =>
  GROUPS.map((key) => ({
    key,
    models: MODELS.filter((m) => m.group === key && (filter.value === 'all' || m.styles.includes(filter.value))),
  })).filter((group) => group.models.length),
)

// Créateur : personnes (lien Wikipédia dans la langue du site s'il existe), puis une ligne discrète
const Creator = defineComponent({
  props: { model: { type: Object, required: true } },
  setup(props) {
    return () => {
      const people = props.model.people.flatMap((person, i) => {
        const url = personUrl(person, locale.value)
        const node = url
          ? h('a', { href: url, target: '_blank', rel: 'noopener', class: 'text-accent underline-offset-4 hover:underline' }, person.name)
          : h('span', { class: 'text-ink' }, person.name)
        return i ? [', ', node] : [node]
      })
      return h('span', { class: 'block' }, [
        people.length ? h('span', { class: 'block' }, people) : null,
        h('span', { class: 'block text-xs text-ink-3' }, t(`modelsPage.models.${props.model.key}.note`)),
      ])
    }
  },
})

// 1. Ton patrimoine face aux modèles
const portfolio = useTable('portfolio')
const user = computed(() => userAllocation(portfolio.data.value))
const userSlices = computed(() => {
  if (!user.value) return []
  const { colors: typeColors } = assignAssetColors(user.value.types.map((type) => type.name))
  return user.value.types.map((type) => ({
    label: capitalize(type.name),
    value: Math.round((type.value / user.value.total) * 1000) / 10,
    color: typeColors.get(type.name)?.color,
  }))
})
const closest = computed(() => (user.value ? closestModels(user.value.shares).slice(0, 3) : []))
</script>
