<!--
  Page « Portfolio Snapshot » (/portfolio-snapshot) : où en est ton patrimoine aujourd'hui.
  Haut : patrimoine brut et net, variation de l'année et du mois, anneau des types d'actifs.
  Bas : pour chaque type d'actif, ses sous-types, instruments, enveloppes, courtiers et zones.
  Calculs dans lib/snapshot.js. La table _history ne sert qu'aux deux variations : si elle manque, la page s'affiche quand même.
-->
<template>
  <div class="page-container py-12 sm:py-16">
    <header class="max-w-3xl">
      <h1 class="text-h2 text-ink">Portfolio Snapshot</h1>
      <p class="mt-3 text-lead text-ink-2" aria-live="polite">{{ subtitle }}</p>
    </header>

    <div
      v-if="status === 'loading'"
      role="status"
      class="mt-10 flex h-80 items-center justify-center rounded-xl bg-wash text-ink-2 motion-safe:animate-pulse"
    >
      Chargement de ton patrimoine…
    </div>

    <div v-else-if="status === 'error'" role="alert" class="mt-10 rounded-xl border border-danger-line bg-danger-wash p-6">
      <p class="font-semibold text-danger">
        {{ missingTable ? 'La table portfolio n’est pas encore dans la base' : 'Impossible de charger les données' }}
      </p>
      <p class="mt-1 text-ink">
        {{
          missingTable
            ? 'Elle n’a pas encore été synchronisée depuis Google Sheets.'
            : portfolio.error.value.message
        }}
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
      <!-- Vue d'ensemble -->
      <section aria-labelledby="titre-actifs" class="mt-10 rounded-xl border border-line bg-white shadow-soft">
        <div class="border-b border-line px-4 py-4 sm:px-6">
          <h2 id="titre-actifs" class="text-h3 text-ink">Tes actifs</h2>
        </div>

        <div class="grid grid-cols-12 gap-y-8 p-4 sm:p-6 lg:gap-x-8">
          <dl class="col-span-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-5 lg:content-center">
            <div v-for="kpi in kpis" :key="kpi.label" class="rounded-lg border border-line bg-wash p-4">
              <dt class="text-sm text-ink-2">{{ kpi.label }}</dt>
              <dd class="mt-1 text-2xl font-bold tabular-nums text-ink">{{ kpi.value }}</dd>
              <dd class="mt-1 text-sm text-ink-3">{{ kpi.hint }}</dd>
            </div>
          </dl>

          <div class="col-span-12 grid items-center gap-8 md:grid-cols-[minmax(0,280px)_minmax(0,1fr)] lg:col-span-7">
            <BaseChart :option="donut" :height="300" :label="donutSummary" />
            <ul class="divide-y divide-line" aria-label="Montants par type d’actif">
              <li v-for="item in model.legend" :key="item.name" class="flex items-center gap-3 py-2.5">
                <span class="h-3 w-3 shrink-0 rounded-[3px]" :style="{ backgroundColor: item.color }" aria-hidden="true"></span>
                <span class="min-w-0 flex-1 text-ink">{{ item.name }}</span>
                <span class="shrink-0 text-right">
                  <span class="block whitespace-nowrap font-semibold tabular-nums text-ink">{{ item.amount }}</span>
                  <span class="block whitespace-nowrap text-sm tabular-nums text-ink-2">{{ item.share }}</span>
                </span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <!-- Détail par type d'actif -->
      <section aria-labelledby="titre-detail" class="mt-14">
        <h2 id="titre-detail" class="text-h3 text-ink">Détail par type d’actif</h2>
        <p class="mt-2 max-w-2xl text-ink-2">
          Pour chaque type : ce qu’il contient, du plus gros au plus petit. Les parts sont celles du type, pas du
          patrimoine entier.
        </p>

        <ul class="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          <li v-for="type in model.types" :key="type.name" class="rounded-xl border border-line bg-white shadow-soft">
            <div class="border-b border-line p-4 sm:p-6">
              <h3 class="flex items-center gap-2 text-h3 text-ink">
                <span class="h-3 w-3 shrink-0 rounded-[3px]" :style="{ backgroundColor: type.color }" aria-hidden="true"></span>
                {{ type.name }}
              </h3>
              <p class="mt-1 tabular-nums text-ink-2">
                <span class="font-semibold text-ink">{{ euro(type.value) }}</span> · {{ percent(type.share) }} du patrimoine
              </p>
            </div>
            <div class="space-y-6 p-4 sm:p-6">
              <section v-for="dim in type.dimensions" :key="dim.key">
                <h4 class="text-sm font-semibold text-ink">{{ dim.label }}</h4>
                <ShareBars class="mt-2.5" :items="dim.items" :color="type.color" :label="`${dim.label} : ${type.name}`" />
              </section>
              <p v-if="!type.dimensions.length" class="text-ink-2">
                Aucune colonne de détail (sous-type, instrument, enveloppe…) dans la table portfolio.
              </p>
            </div>
          </li>
        </ul>

        <p v-if="model.missing.length" class="mt-6 text-ink-2">Sans données : {{ model.missing.join(', ') }}.</p>
      </section>

      <p class="mt-12 max-w-3xl border-t border-line pt-6 text-sm text-ink-2">
        <template v-if="model.usedColumns.length">Colonnes lues pour le détail : {{ model.usedColumns.join(' ; ') }}. </template>
        <template v-if="model.missingDimensions.length">
          Pas de colonne pour : {{ model.missingDimensions.join(', ') }}.
        </template>
        Les variations de l’année et du mois comparent le patrimoine brut aux relevés de la table _history ; elles
        incluent tes versements et retraits. Pour mettre les données à jour, utilise le bouton Tout actualiser de la page
        <router-link to="/sheet" class="font-semibold text-accent underline underline-offset-4 hover:text-accent-hover">
          GoogleSheet</router-link
        >.
      </p>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import AppButton from '../components/ui/AppButton.vue'
import BaseChart from '../components/charts/BaseChart.vue'
import ShareBars from '../components/charts/ShareBars.vue'
import { useTable } from '../composables/useTable.js'
import { DataError } from '../lib/aggregate.js'
import { donutOption } from '../lib/charts/assetDonut.js'
import { euro, formatDateLong, percent } from '../lib/format.js'
import { buildSnapshot, signedPercent2 } from '../lib/snapshot.js'

const portfolio = useTable('portfolio')
const history = useTable('_history') // facultative : sert aux variations de l'année et du mois

// Une DataError (colonne absente…) devient un message lisible ; toute autre erreur est un bug à voir en console.
const model = computed(() => {
  if (!portfolio.data.value) return null
  try {
    return buildSnapshot(portfolio.data.value, history.data.value)
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

const subtitle = computed(() =>
  model.value?.asOf ? `Positions au ${formatDateLong(model.value.asOf)}.` : 'Ton patrimoine aujourd’hui, type d’actif par type d’actif.',
)

const donut = computed(() => (status.value === 'ready' ? donutOption(model.value.parts, model.value.gross) : {}))
const donutSummary = computed(() =>
  status.value === 'ready'
    ? `Anneau de ${model.value.legend.length} types d’actifs pour ${euro(model.value.gross)} au total. Le plus gros : ${model.value.legend[0].name}, ${model.value.legend[0].share}.`
    : '',
)

// Quatre repères : brut, net, année, mois
const kpis = computed(() => {
  if (status.value !== 'ready') return []
  const m = model.value
  const since = (change) => `Depuis le ${formatDateLong(change.since)}`
  const missing = history.data.value ? 'Pas assez de relevés dans _history' : history.loading.value ? 'Chargement…' : 'Historique indisponible'
  return [
    { label: 'Patrimoine brut', value: euro(m.gross), hint: 'Total des actifs' },
    {
      label: 'Patrimoine net',
      value: euro(m.net),
      hint: m.hasLiabilities ? `Après ${euro(Math.abs(m.liabilities))} de dettes` : 'Pas de colonne de dettes',
    },
    {
      label: 'Cette année',
      value: m.changes.year ? signedPercent2(m.changes.year.fraction) : '–',
      hint: m.changes.year ? since(m.changes.year) : missing,
    },
    {
      label: 'Ce mois-ci',
      value: m.changes.month ? signedPercent2(m.changes.month.fraction) : '–',
      hint: m.changes.month ? since(m.changes.month) : missing,
    },
  ]
})
</script>
