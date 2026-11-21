<!--
  Page « Stratégie CTO » (/strategie) : tes actions regroupées de plusieurs façons, en anneaux à deux niveaux
  (secteur, moat, localisation, note S&P, business, place de cotation, instruments).
  Tables lues : portfolio (obligatoire) et stock (facultative : elle fournit les attributs absents de portfolio).
  Calculs dans lib/strategy.js ; le choix d'enveloppe (PEA et CTO, CTO seul…) filtre toutes les cartes à la fois.
-->
<template>
  <div>
    <header class="max-w-3xl">
      <h1 class="text-h2 text-ink">Stratégie CTO</h1>
      <p class="mt-3 text-lead text-ink-2" aria-live="polite">{{ subtitle }}</p>
    </header>

    <div
      v-if="status === 'loading'"
      role="status"
      class="mt-10 flex h-80 items-center justify-center rounded-xl bg-wash text-ink-2 motion-safe:animate-pulse"
    >
      Chargement de tes actions…
    </div>

    <div v-else-if="status === 'error'" role="alert" class="mt-10 rounded-xl border border-danger-line bg-danger-wash p-6">
      <p class="font-semibold text-danger">
        {{ missingTable ? 'La table portfolio n’est pas encore dans la base' : 'Impossible de charger les données' }}
      </p>
      <p class="mt-1 text-ink">
        {{ missingTable ? 'Elle n’a pas encore été synchronisée depuis Google Sheets.' : portfolio.error.value.message }}
      </p>
      <div class="mt-4 flex flex-wrap gap-3">
        <AppButton v-if="missingTable" :to="{ path: '/sheet', query: { onglet: 'portfolio' } }" variant="secondary" size="sm">
          Ouvrir la page GoogleSheet
        </AppButton>
        <AppButton variant="secondary" size="sm" @click="portfolio.reload">Réessayer</AppButton>
      </div>
    </div>

    <div v-else-if="status === 'problem'" role="alert" class="mt-10 rounded-xl border border-danger-line bg-danger-wash p-6">
      <p class="font-semibold text-danger">Les données ne correspondent pas à cette page</p>
      <p class="mt-1 text-ink">{{ model.problem }}</p>
      <p class="mt-3 text-sm text-ink-2">Compare avec les noms de colonnes de la page GoogleSheet.</p>
    </div>

    <div
      v-else-if="status === 'empty'"
      class="mt-10 flex h-56 flex-col items-center justify-center rounded-xl border border-dashed border-line-strong bg-wash px-6 text-center"
    >
      <p class="font-semibold text-ink">Pas de données à afficher</p>
      <p class="mt-1 max-w-md text-ink-2">{{ model.empty }}</p>
    </div>

    <template v-else>
      <!-- Choix de l'enveloppe : filtre tous les anneaux -->
      <div v-if="model.scopes.length" class="mt-10 max-w-sm">
        <label for="enveloppe" class="block text-sm font-medium text-ink">Enveloppe</label>
        <div class="relative mt-1.5">
          <select
            id="enveloppe"
            v-model="scope"
            class="h-11 w-full appearance-none rounded-lg border border-line-strong bg-white pl-3.5 pr-10 text-[0.9375rem] text-ink"
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

      <ul class="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <li v-for="chart in model.charts" :key="chart.key" class="min-w-0">
          <StrategyCard :chart="chart" class="h-full" />
        </li>
      </ul>

      <section v-if="model.skipped.length" class="mt-8 rounded-xl border border-line bg-wash p-5 sm:p-6" aria-labelledby="titre-absents">
        <h2 id="titre-absents" class="text-h3 text-ink">Anneaux non affichés</h2>
        <p class="mt-2 text-ink-2">
          Pas de colonne trouvée, ni dans portfolio ni dans stock, pour :
          {{ model.skipped.map((item) => `${item.title} (« ${item.tried} »)`).join(', ') }}.
          Dès qu’une colonne de ce nom existe dans la feuille et que tu as cliqué sur Tout actualiser, l’anneau apparaît.
        </p>
      </section>

      <div class="mt-12 max-w-3xl border-t border-line pt-6 text-sm text-ink-2">
        <p>
          Chaque anneau additionne le montant « Assets Master Currency » des lignes supérieures à 0{{
            model.scopeLabel ? ` (enveloppe : ${model.scopeLabel})` : ''
          }}. Pour mettre les données à jour, utilise le bouton Tout actualiser de la page
          <router-link to="/sheet" class="font-semibold text-accent underline underline-offset-4 hover:text-accent-hover">
            GoogleSheet</router-link
          >.
        </p>
        <p v-for="note in model.notes" :key="note" class="mt-2">{{ note }}</p>
        <details class="mt-3">
          <summary class="cursor-pointer font-medium text-ink">Colonnes lues dans la feuille</summary>
          <ul class="mt-2 list-disc space-y-1 pl-5">
            <li v-for="column in model.usedColumns" :key="column">{{ column }}</li>
          </ul>
        </details>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import AppButton from '../components/ui/AppButton.vue'
import StrategyCard from '../components/charts/StrategyCard.vue'
import { useTable } from '../composables/useTable.js'
import { DataError } from '../lib/aggregate.js'
import { buildStrategy } from '../lib/strategy.js'

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
    return { problem: `La page n’a pas pu être construite (${err?.message ?? 'erreur inconnue'}).` }
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
  () => (status.value === 'ready' && model.value.subtitle) || 'Tes actions regroupées de plusieurs façons, sur deux niveaux.',
)

// Le sélecteur lit le choix effectif (celui par défaut tant qu'on n'a rien choisi)
const scope = computed({
  get: () => model.value?.scope ?? 'all',
  set: (value) => {
    scopeChoice.value = value
  },
})
</script>
