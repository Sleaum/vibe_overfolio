<!--
  Page « Stratégie CTO » (/strategie) : tes actions regroupées de plusieurs façons :
  une carte du monde des pays en premier (colonne Area, components/charts/WorldMapCard.vue), puis les anneaux
  (secteur, moat, localisation, note S&P, business, place de cotation, instruments).
  Tables lues : portfolio (obligatoire) et stock (facultative : elle fournit les attributs absents de portfolio).
  Calculs dans lib/strategy.js ; le choix d'enveloppe (PEA et CTO, CTO seul…) filtre toutes les cartes à la fois.
-->
<template>
  <div>
    <header class="max-w-3xl">
      <h1 class="text-h2 text-ink">{{ t('pages.strategy') }}</h1>
      <p class="mt-3 text-lead text-ink-2" aria-live="polite">{{ subtitle }}</p>
      <ConversionNote :table="portfolio.data.value" class="mt-2" />
    </header>

    <PageState
      :status="status"
      :error="error"
      :missing-table="missingTable"
      :problem="model?.problem"
      :empty="model?.empty"
      :reload="reload"
      table="portfolio"
      kind="page"
      :loading-text="t('strategyPage.loading')"
    >
      <!-- Choix de l'enveloppe : filtre tous les anneaux -->
      <div v-if="model.scopes.length" class="mt-10 max-w-sm">
        <label for="enveloppe" class="block text-sm font-medium text-ink">{{ t('strategyPage.envelope') }}</label>
        <div class="relative mt-1.5">
          <select
            id="enveloppe"
            v-model="scope"
            class="h-11 w-full appearance-none rounded-lg border border-line-strong bg-paper pl-3.5 pr-10 text-[0.9375rem] text-ink"
          >
            <option v-for="option in model.scopes" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
          <svg
            viewBox="0 0 20 20"
            class="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-2"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M5 8l5 5 5-5" />
          </svg>
        </div>
      </div>

      <!-- Carte du monde en premier : pays de la colonne Area, même choix d'enveloppe que les anneaux -->
      <WorldMapCard v-if="model.map" class="mt-8" :map="model.map" />
      <ul class="grid grid-cols-1 gap-6 lg:grid-cols-2" :class="model.map ? 'mt-6' : 'mt-8'">
        <li v-for="chart in model.charts" :key="chart.key" class="min-w-0">
          <StrategyCard :chart="chart" class="h-full" />
        </li>
      </ul>

      <section v-if="model.skipped.length" class="mt-8 rounded-xl border border-line bg-wash p-5 sm:p-6" aria-labelledby="titre-absents">
        <h2 id="titre-absents" class="text-h3 text-ink">{{ t('strategyPage.skippedTitle') }}</h2>
        <p class="mt-2 text-ink-2">
          {{
            t('strategyPage.skippedText', {
              list: model.skipped.map((item) => t('strategyPage.skippedItem', { title: item.title, tried: item.tried })).join(', '),
            })
          }}
        </p>
      </section>

      <div class="mt-12 max-w-3xl border-t border-line pt-6 text-sm text-ink-2">
        <i18n-t :keypath="model.scopeLabel ? 'strategyPage.footerScope' : 'strategyPage.footer'" tag="p" scope="global">
          <template #scope>{{ model.scopeLabel }}</template>
          <template #sheet>
            <router-link to="/sheet" class="font-semibold text-accent underline underline-offset-4 hover:text-accent-hover">GoogleSheet</router-link>
          </template>
        </i18n-t>
        <p v-for="note in model.notes" :key="note" class="mt-2">{{ note }}</p>
        <details class="mt-3">
          <summary class="cursor-pointer font-medium text-ink">{{ t('strategyPage.columnsRead') }}</summary>
          <ul class="mt-2 list-disc space-y-1 pl-5">
            <li v-for="column in model.usedColumns" :key="column">{{ column }}</li>
          </ul>
        </details>
      </div>
    </PageState>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { computed, ref } from 'vue'
import PageState from '../components/PageState.vue'
import StrategyCard from '../components/charts/StrategyCard.vue'
import WorldMapCard from '../components/charts/WorldMapCard.vue'
import { usePageModel } from '../composables/usePageModel.js'
import ConversionNote from '../components/ConversionNote.vue'
import { buildStrategy } from '../lib/strategy.js'

const { t } = useI18n()

const scopeChoice = ref(undefined) // undefined = choix par défaut (PEA et CTO s'ils existent)

// stock est facultative (une table absente n'empêche pas la page de s'afficher), mais la page attend sa réponse
// pour ne pas afficher un instant des anneaux sans secteur
const { status, model, error, missingTable, tables, reload } = usePageModel({
  required: ['portfolio'],
  optional: ['stock'],
  waitOptional: true,
  build: ({ portfolio, stock }) => buildStrategy(portfolio, stock, scopeChoice.value),
})
const { portfolio } = tables

const subtitle = computed(
  () => (status.value === 'ready' && model.value.subtitle) || t('strategyPage.defaultSubtitle'),
)

// Le sélecteur lit le choix effectif (celui par défaut tant qu'on n'a rien choisi)
const scope = computed({
  get: () => model.value?.scope ?? 'all',
  set: (value) => {
    scopeChoice.value = value
  },
})
</script>
