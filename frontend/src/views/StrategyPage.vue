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
    </header>

    <div
      v-if="status === 'loading'"
      role="status"
      class="mt-10 flex h-80 items-center justify-center rounded-xl bg-wash text-ink-2 motion-safe:animate-pulse"
    >
      {{ t('strategyPage.loading') }}
    </div>

    <div v-else-if="status === 'error'" role="alert" class="mt-10 rounded-xl border border-danger-line bg-danger-wash p-6">
      <p class="font-semibold text-danger">
        {{ missingTable ? t('page.tableMissing', { table: 'portfolio' }) : t('chartUi.loadErrorTitle') }}
      </p>
      <p class="mt-1 text-ink">
        {{ missingTable ? t('page.notSyncedYet') : portfolio.error.value.message }}
      </p>
      <div class="mt-4 flex flex-wrap gap-3">
        <AppButton v-if="missingTable" :to="{ path: '/sheet', query: { onglet: 'portfolio' } }" variant="secondary" size="sm">
          {{ t('chartUi.openSheet') }}
        </AppButton>
        <AppButton variant="secondary" size="sm" @click="portfolio.reload">{{ t('chartUi.retry') }}</AppButton>
      </div>
    </div>

    <div v-else-if="status === 'problem'" role="alert" class="mt-10 rounded-xl border border-danger-line bg-danger-wash p-6">
      <p class="font-semibold text-danger">{{ t('page.problemTitle') }}</p>
      <p class="mt-1 text-ink">{{ model.problem }}</p>
      <p class="mt-3 text-sm text-ink-2">{{ t('chartUi.problemHint') }}</p>
    </div>

    <div
      v-else-if="status === 'empty'"
      class="mt-10 flex h-56 flex-col items-center justify-center rounded-xl border border-dashed border-line-strong bg-wash px-6 text-center"
    >
      <p class="font-semibold text-ink">{{ t('chartUi.emptyTitle') }}</p>
      <p class="mt-1 max-w-md text-ink-2">{{ model.empty }}</p>
    </div>

    <template v-else>
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
    </template>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { computed, ref } from 'vue'
import AppButton from '../components/ui/AppButton.vue'
import StrategyCard from '../components/charts/StrategyCard.vue'
import WorldMapCard from '../components/charts/WorldMapCard.vue'
import { useTable } from '../composables/useTable.js'
import { DataError } from '../lib/aggregate.js'
import { buildStrategy } from '../lib/strategy.js'

const { t } = useI18n()

const portfolio = useTable('portfolio')
const stock = useTable('stock') // facultative : une erreur (table absente) n'empêche pas la page de s'afficher

const scopeChoice = ref(undefined) // undefined = choix par défaut (PEA et CTO s'ils existent)

// La page attend que stock ait répondu (ou échoué) pour ne pas afficher un instant des anneaux sans secteur
const settled = computed(() => Boolean(stock.data.value || stock.error.value))

// Une DataError (colonne absente…) devient un message lisible ; toute autre erreur est un bug à voir en console.
const model = computed(() => {
  if (!portfolio.data.value || !settled.value) return null
  try {
    return buildStrategy(portfolio.data.value, stock.data.value, scopeChoice.value)
  } catch (err) {
    if (err instanceof DataError) return { problem: err.message }
    console.error(err)
    return { problem: t('page.buildFailed', { message: err?.message ?? t('chartUi.unknownError') }) }
  }
})

const status = computed(() => {
  if (!portfolio.data.value) return portfolio.error.value ? 'error' : 'loading'
  if (!model.value) return 'loading'
  if (model.value.problem) return 'problem'
  if (model.value.empty) return 'empty'
  return 'ready'
})

const missingTable = computed(() => portfolio.error.value?.status === 404)

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
