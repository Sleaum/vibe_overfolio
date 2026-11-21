<!--
  Page « Simulation » (/simulation) : simulation de Monte-Carlo du patrimoine net, avec la probabilité d'atteindre ton
  objectif. Calculs dans lib/simulation.js, exécutés dans un Web Worker (lib/simulation.worker.js).
  Point de départ lu dans la base : portfolio (montants par type d'actif et dettes), inout (versement moyen, facultatif),
  _history (objectifs, facultatif). Toutes les hypothèses se modifient dans la page et sont retenues par le navigateur.
-->
<template>
  <div>
    <header class="max-w-3xl">
      <h1 class="text-h2 text-ink">Simulation</h1>
      <p class="mt-3 text-lead text-ink-2">
        {{ runsLabel }} avenirs possibles pour ton patrimoine net, tirés au hasard à partir de tes montants actuels et des
        hypothèses ci-dessous. La fourchette montre ce qui peut raisonnablement arriver, pas une prévision.
      </p>
    </header>

    <div
      v-if="status === 'loading'"
      role="status"
      class="mt-10 flex h-80 items-center justify-center rounded-xl bg-wash text-ink-2 motion-safe:animate-pulse"
    >
      Chargement de ton patrimoine…
    </div>

    <div v-else-if="status === 'error'" role="alert" class="mt-10 rounded-xl border border-danger-line bg-danger-wash p-6">
      <p class="font-semibold text-danger">Impossible de préparer la simulation</p>
      <p class="mt-1 text-ink">{{ problem }}</p>
      <div class="mt-4 flex flex-wrap gap-3">
        <AppButton :to="{ path: '/sheet', query: { onglet: 'portfolio' } }" variant="secondary" size="sm">Ouvrir la page GoogleSheet</AppButton>
        <AppButton variant="secondary" size="sm" @click="portfolio.reload">Réessayer</AppButton>
      </div>
    </div>

    <template v-else>
      <!-- Repères -->
      <section aria-labelledby="titre-resultats" class="mt-10">
        <h2 id="titre-resultats" class="sr-only">Résultats</h2>
        <dl class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-live="polite">
          <div v-for="kpi in kpis" :key="kpi.label" class="rounded-xl border border-line bg-white p-5 shadow-soft">
            <dt class="text-sm text-ink-2">{{ kpi.label }}</dt>
            <dd class="mt-1 text-2xl font-bold tabular-nums" :class="kpi.tone || 'text-ink'">{{ kpi.value }}</dd>
            <dd class="mt-1 text-sm text-ink-3">{{ kpi.hint }}</dd>
          </div>
        </dl>
      </section>

      <!-- Éventail -->
      <section class="mt-8 rounded-xl border border-line bg-white shadow-soft" aria-labelledby="titre-eventail">
        <header class="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-b border-line px-4 py-4 sm:px-6">
          <div class="min-w-0">
            <h2 id="titre-eventail" class="text-h3 text-ink">Patrimoine net simulé</h2>
            <p class="mt-1 text-ink-2">
              {{ settings.real ? 'En euros d’aujourd’hui (inflation déduite).' : 'En euros courants.' }}
              <span v-if="computing" class="ml-1 text-ink-3">Calcul en cours…</span>
            </p>
          </div>
          <div class="flex flex-wrap gap-3">
            <SegmentedControl v-model="unit" :options="UNITS" label="Unité" />
            <SegmentedControl v-model="view" :options="VIEWS" label="Affichage" />
          </div>
        </header>
        <div class="p-4 sm:p-6">
          <div v-if="!result" class="flex h-80 items-center justify-center rounded-lg bg-wash text-ink-2 motion-safe:animate-pulse">
            Calcul des {{ runsLabel }} trajectoires…
          </div>
          <template v-else>
            <DataTableView
              v-if="view === 'table'"
              :columns="table.columns"
              :rows="table.rows"
              :numeric="table.numeric"
              caption="Patrimoine net simulé, version tableau"
            />
            <BaseChart v-else :option="option" :height="420" :min-width="560" :label="summary" />
            <p class="mt-4 text-sm text-ink-2">
              La ligne bleue est la médiane : une trajectoire sur deux finit au-dessus. La bande foncée contient la moitié des
              trajectoires (25 à 75 %), la bande claire 8 sur 10 (10 à 90 %).
            </p>
          </template>
        </div>
      </section>

      <!-- Hypothèses -->
      <section class="mt-8 rounded-xl border border-line bg-white shadow-soft" aria-labelledby="titre-hypotheses">
        <header class="flex flex-wrap items-start justify-between gap-4 border-b border-line px-4 py-4 sm:px-6">
          <div>
            <h2 id="titre-hypotheses" class="text-h3 text-ink">Hypothèses</h2>
            <p class="mt-1 text-ink-2">
              Point de départ : ton relevé du {{ startLabel }}. Les modifications sont retenues par ce navigateur.
            </p>
          </div>
          <AppButton variant="secondary" size="sm" @click="resetSettings">Revenir aux valeurs par défaut</AppButton>
        </header>

        <div class="grid gap-x-6 gap-y-5 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
          <NumberField id="sim-versement" v-model="settings.contribution" label="Versement net mensuel" suffix="€" :step="50" :hint="contributionHint" />
          <NumberField id="sim-hausse" v-model="settings.contributionGrowth" label="Hausse du versement" suffix="% par an" :step="0.5" hint="Suit par exemple ton salaire." />
          <NumberField id="sim-pret" v-model="settings.debtPayment" label="Capital de prêt remboursé" suffix="€ / mois" :step="50" :hint="debtHint" />
          <NumberField id="sim-objectif" v-model="settings.goalAmount" label="Objectif de patrimoine net" suffix="€" :step="10000" :hint="goalHint" />
          <div>
            <label for="sim-date" class="block text-sm font-medium text-ink">Date de l’objectif</label>
            <input
              id="sim-date"
              v-model="settings.goalDate"
              type="date"
              class="mt-1 w-full rounded-lg border border-line-strong bg-white px-3 py-2 text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
            <p class="mt-1 text-sm text-ink-3">La simulation va jusqu’à cette date.</p>
          </div>
          <NumberField id="sim-frais" v-model="settings.fees" label="Frais annuels" suffix="%" :step="0.05" hint="ETF, courtiers, gestion : sur les actifs financiers." />
          <NumberField id="sim-inflation" v-model="settings.inflation" label="Inflation" suffix="% par an" :step="0.1" hint="Sert aux montants en euros d’aujourd’hui." />
          <div class="flex items-start gap-3 sm:col-span-2 lg:col-span-2">
            <input id="sim-queues" v-model="settings.fatTails" type="checkbox" class="mt-1 h-4 w-4 accent-accent" />
            <label for="sim-queues" class="text-ink">
              Krachs plus fréquents qu’une loi normale
              <span class="block text-sm text-ink-3">
                Loi de Student à 5 degrés de liberté : plus réaliste pour les actions et la crypto. Décoché, la simulation est
                plus optimiste dans les mauvaises années.
              </span>
            </label>
          </div>
        </div>

        <div class="border-t border-line p-4 sm:p-6">
          <h3 class="font-semibold text-ink">Par type d’actif</h3>
          <p class="mt-1 max-w-3xl text-sm text-ink-2">
            Rendement : moyenne annuelle attendue. Volatilité : ampleur des variations d’une année (environ 2 années sur 3
            restent dans ± cette valeur). Lien avec les actions : 1 = bouge exactement avec le marché actions, 0 = sans
            rapport, négatif = tend à monter quand il baisse. Les versements sont répartis entre les types cochés, au
            prorata de leurs montants.
          </p>
          <div class="mt-4 overflow-x-auto">
            <table class="w-full min-w-[640px] text-left text-sm">
              <thead class="border-b border-line text-ink-2">
                <tr>
                  <th scope="col" class="py-2 pr-4 font-medium">Type d’actif</th>
                  <th scope="col" class="py-2 pr-4 text-right font-medium">Montant actuel</th>
                  <th scope="col" class="py-2 pr-4 font-medium">Rendement (%/an)</th>
                  <th scope="col" class="py-2 pr-4 font-medium">Volatilité (%)</th>
                  <th scope="col" class="py-2 pr-4 font-medium">Lien avec les actions</th>
                  <th scope="col" class="py-2 font-medium">Reçoit les versements</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="asset in assetRows" :key="asset.name" class="border-b border-line last:border-0">
                  <th scope="row" class="py-2 pr-4 font-medium text-ink">{{ asset.label }}</th>
                  <td class="py-2 pr-4 text-right tabular-nums text-ink">{{ euro(asset.amount) }}</td>
                  <td class="py-2 pr-4">
                    <input v-model.number="settings.assets[asset.name].mu" type="number" step="0.5" :aria-label="`Rendement de ${asset.label}, en % par an`" :class="cellInput" />
                  </td>
                  <td class="py-2 pr-4">
                    <input v-model.number="settings.assets[asset.name].sigma" type="number" step="1" min="0" :aria-label="`Volatilité de ${asset.label}, en %`" :class="cellInput" />
                  </td>
                  <td class="py-2 pr-4">
                    <input v-model.number="settings.assets[asset.name].rho" type="number" step="0.05" min="-1" max="1" :aria-label="`Lien de ${asset.label} avec les actions, de -1 à 1`" :class="cellInput" />
                  </td>
                  <td class="py-2">
                    <input v-model="settings.assets[asset.name].invest" type="checkbox" class="h-4 w-4 accent-accent" :aria-label="`${asset.label} reçoit les versements`" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section class="mt-8 max-w-3xl text-ink-2" aria-labelledby="titre-limites">
        <h2 id="titre-limites" class="text-h3 text-ink">Ce que la simulation ne fait pas</h2>
        <ul class="mt-3 list-disc space-y-1 pl-5">
          <li>Pas d’impôt à la sortie (PEA, CTO, PER n’ont pas la même fiscalité) : les montants sont avant impôt.</li>
          <li>Pas de rééquilibrage : la répartition dérive au fil des tirages, comme si tu ne vendais jamais.</li>
          <li>Les rendements par défaut sont des ordres de grandeur de long terme, pas des promesses : change-les.</li>
          <li>
            Le passé récent de ta feuille (environ deux ans) est trop court pour en tirer des rendements : il n’est pas
            utilisé pour les hypothèses.
          </li>
        </ul>
        <p class="mt-4 text-sm">C’est un outil de projection, pas un conseil en investissement.</p>
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, defineComponent, h, onBeforeUnmount, reactive, ref, watch } from 'vue'
import AppButton from '../components/ui/AppButton.vue'
import SegmentedControl from '../components/ui/SegmentedControl.vue'
import BaseChart from '../components/charts/BaseChart.vue'
import DataTableView from '../components/charts/DataTableView.vue'
import { useTable } from '../composables/useTable.js'
import { DataError } from '../lib/aggregate.js'
import { fanOption } from '../lib/charts/simulationFan.js'
import { capitalize, euro, formatDateLong, formatMonthYear, percent } from '../lib/format.js'
import { assumptionFor, averageContribution, monthsBetween, readGoals, readPortfolio } from '../lib/simulation.js'

const RUNS = 5000
const STORAGE_KEY = 'overfolio.simulation.v1'
const UNITS = [
  { value: 'real', label: 'Euros d’aujourd’hui' },
  { value: 'nominal', label: 'Euros courants' },
]
const VIEWS = [
  { value: 'chart', label: 'Graphique' },
  { value: 'table', label: 'Tableau' },
]
const cellInput =
  'w-24 rounded-md border border-line-strong bg-white px-2 py-1 text-right tabular-nums text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent'
const runsLabel = new Intl.NumberFormat('fr-FR').format(RUNS)

// Champ numérique avec libellé, unité et aide
const NumberField = defineComponent({
  props: { id: String, label: String, suffix: String, hint: String, step: Number, modelValue: Number },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () =>
      h('div', [
        h('label', { for: props.id, class: 'block text-sm font-medium text-ink' }, props.label),
        h('div', { class: 'mt-1 flex items-center gap-2' }, [
          h('input', {
            id: props.id,
            type: 'number',
            step: props.step,
            value: props.modelValue,
            'aria-describedby': props.hint ? `${props.id}-aide` : undefined,
            class:
              'w-full rounded-lg border border-line-strong bg-white px-3 py-2 text-right tabular-nums text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            onInput: (event) => {
              const value = event.target.valueAsNumber
              if (Number.isFinite(value)) emit('update:modelValue', value)
            },
          }),
          h('span', { class: 'shrink-0 text-sm text-ink-2' }, props.suffix),
        ]),
        props.hint ? h('p', { id: `${props.id}-aide`, class: 'mt-1 text-sm text-ink-3' }, props.hint) : null,
      ])
  },
})

/* ---------- Données ---------- */

const portfolio = useTable('portfolio')
const inout = useTable('inout') // facultative
const history = useTable('_history') // facultative

const start = computed(() => {
  if (!portfolio.data.value) return null
  try {
    const read = readPortfolio(portfolio.data.value)
    if (!read.assets.length) throw new DataError('La table portfolio ne contient aucun montant positif dans Assets Master Currency.')
    return { ...read, date: read.date || new Date().toISOString().slice(0, 10) }
  } catch (err) {
    return { problem: err instanceof DataError ? err.message : `Lecture impossible (${err?.message ?? 'erreur inconnue'}).` }
  }
})
const settled = (table) => Boolean(table.data.value || table.error.value)
const status = computed(() => {
  if (portfolio.error.value) return 'error'
  if (!start.value || !settled(inout) || !settled(history)) return 'loading'
  if (start.value.problem) return 'error'
  return 'ready'
})
const problem = computed(() => start.value?.problem ?? portfolio.error.value?.message ?? '')
const startLabel = computed(() => (start.value?.date ? formatDateLong(start.value.date) : ''))

/* ---------- Hypothèses ---------- */

const settings = reactive({ assets: {} })
const unit = ref('nominal')
const view = ref('chart')
watch(unit, (value) => (settings.real = value === 'real'))

const averageIn = computed(() => {
  try {
    return averageContribution(inout.data.value)
  } catch {
    return null
  }
})
const goals = computed(() => (start.value?.date ? readGoals(history.data.value, start.value.date) : []))

function defaults() {
  const goal = goals.value[0]
  const startDate = start.value.date
  const [y, m, d] = startDate.split('-').map(Number)
  return {
    contribution: Math.round(averageIn.value ?? 0),
    contributionGrowth: 0,
    debtPayment: 0,
    fees: 0.3,
    inflation: 2,
    fatTails: true,
    real: false, // les objectifs de la feuille sont en euros courants
    goalAmount: goal?.amount ?? Math.round(sumAssets() * 2),
    goalDate: goal?.iso ?? `${y + 15}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    assets: Object.fromEntries(
      start.value.assets.map((asset) => {
        const a = assumptionFor(asset.name)
        return [asset.name, { mu: round(a.mu * 100), sigma: round(a.sigma * 100), rho: a.rho, invest: a.invest, fees: a.fees }]
      }),
    ),
  }
}
const round = (x) => Math.round(x * 100) / 100
const sumAssets = () => start.value.assets.reduce((sum, asset) => sum + asset.amount, 0)

function load() {
  const base = defaults()
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    if (saved && typeof saved === 'object') {
      for (const key of Object.keys(base)) if (key !== 'assets' && saved[key] !== undefined) base[key] = saved[key]
      for (const name of Object.keys(base.assets)) if (saved.assets?.[name]) Object.assign(base.assets[name], saved.assets[name])
    }
  } catch {
    // stockage indisponible ou illisible : valeurs par défaut
  }
  Object.assign(settings, base)
  unit.value = settings.real ? 'real' : 'nominal'
}

function resetSettings() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // rien à faire
  }
  Object.assign(settings, defaults())
  unit.value = settings.real ? 'real' : 'nominal'
}

watch(status, (value) => value === 'ready' && !settings.goalDate && load(), { immediate: true })

const assetRows = computed(() =>
  (start.value?.assets ?? [])
    .filter((asset) => settings.assets[asset.name])
    .map((asset) => ({ ...asset, label: capitalize(asset.name) })),
)

/* ---------- Calcul (Web Worker) ---------- */

const months = computed(() => (settings.goalDate && start.value?.date ? monthsBetween(start.value.date, settings.goalDate) : 0))
const params = computed(() => {
  if (status.value !== 'ready' || !settings.goalDate) return null
  const horizon = Math.max(12, months.value)
  const inflation = (settings.inflation || 0) / 100
  const goalMonths = months.value
  // L'objectif est exprimé dans l'unité affichée : en euros d'aujourd'hui, il grossit avec l'inflation
  const goalNominal = settings.real ? settings.goalAmount * (1 + inflation) ** (goalMonths / 12) : settings.goalAmount
  const [y, m] = start.value.date.split('-').map(Number)
  return {
    assets: start.value.assets.map((asset) => {
      const a = settings.assets[asset.name] ?? {}
      return {
        name: asset.name,
        amount: asset.amount,
        mu: (Number(a.mu) || 0) / 100,
        sigma: Math.max(0, Number(a.sigma) || 0) / 100,
        rho: Number(a.rho) || 0,
        invest: Boolean(a.invest),
        fees: Boolean(a.fees),
      }
    }),
    debt: start.value.debt,
    debtPayment: Math.max(0, settings.debtPayment || 0),
    contribution: settings.contribution || 0,
    contributionGrowth: (settings.contributionGrowth || 0) / 100,
    fees: Math.max(0, settings.fees || 0) / 100,
    inflation,
    years: horizon / 12,
    runs: RUNS,
    seed: 20261121,
    fatTails: settings.fatTails,
    goal: goalMonths > 0 && settings.goalAmount > 0 ? { months: goalMonths, amount: goalNominal } : null,
    startYear: y + (m - 1) / 12,
  }
})

const result = ref(null)
const computing = ref(false)
let worker = null
let lastId = 0
let timer = null

function run(p) {
  if (!p) return
  computing.value = true
  const id = ++lastId
  try {
    worker ??= new Worker(new URL('../lib/simulation.worker.js', import.meta.url), { type: 'module' })
    worker.onmessage = (event) => {
      if (event.data.id !== lastId) return // une réponse plus récente est attendue
      computing.value = false
      if (event.data.error) console.error(event.data.error)
      else result.value = event.data.result
    }
    worker.postMessage({ id, params: JSON.parse(JSON.stringify(p)) })
  } catch (err) {
    computing.value = false
    console.error(err)
  }
}

watch(
  params,
  (p) => {
    clearTimeout(timer)
    timer = setTimeout(() => run(p), result.value ? 350 : 0)
    try {
      if (settings.goalDate) localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch {
      // stockage indisponible : la page marche quand même
    }
  },
  { deep: true },
)
onBeforeUnmount(() => {
  clearTimeout(timer)
  worker?.terminate()
})

/* ---------- Affichage ---------- */

const points = computed(() => {
  if (!result.value || !start.value) return []
  const [y, m] = start.value.date.split('-').map(Number)
  const today = sumAssets() - start.value.debt
  return [
    // Point de départ : le patrimoine net d'aujourd'hui, identique dans toutes les trajectoires
    { label: formatMonthYear(Date.UTC(y, m - 1, 1)), month: 0, values: [today, today, today, today, today] },
    ...result.value.years.map((year) => ({
      label: formatMonthYear(Date.UTC(y, m - 1 + year.month, 1)),
      month: year.month,
      values: settings.real ? year.real : year.nominal,
    })),
  ]
})
const last = computed(() => points.value[points.value.length - 1])

const goalPoint = computed(() => {
  if (!points.value.length || !(settings.goalAmount > 0) || months.value <= 0) return null
  const nearest = points.value.reduce((best, point) =>
    Math.abs(point.month - months.value) < Math.abs(best.month - months.value) ? point : best,
  )
  // L'objectif est saisi dans l'unité affichée : il se place tel quel sur le graphique
  return { label: nearest.label, amount: settings.goalAmount }
})

const option = computed(() => fanOption(points.value, goalPoint.value))

const goalLabel = computed(() => (settings.goalDate ? formatDateLong(settings.goalDate) : ''))
const kpis = computed(() => {
  if (!result.value || !last.value) return []
  const [p10, , p50, , p90] = last.value.values
  const chance = result.value.goalChance
  const unitText = settings.real ? 'en euros d’aujourd’hui' : 'en euros courants'
  return [
    {
      label: 'Chance d’atteindre l’objectif',
      value: chance === null ? '–' : percent(chance),
      hint: chance === null ? 'Choisis un objectif et une date future.' : `${euro(settings.goalAmount)} au ${goalLabel.value}`,
      tone: chance === null ? '' : chance >= 0.75 ? 'text-success' : chance < 0.4 ? 'text-danger' : 'text-ink',
    },
    { label: `Médiane en ${last.value.label}`, value: euro(p50), hint: `Une trajectoire sur deux fait mieux, ${unitText}.` },
    { label: 'Scénario défavorable', value: euro(p10), hint: '1 trajectoire sur 10 fait moins bien.' },
    { label: 'Scénario favorable', value: euro(p90), hint: '1 trajectoire sur 10 fait mieux.' },
  ]
})

const summary = computed(() => {
  if (!last.value) return 'Simulation du patrimoine net'
  const [p10, , p50, , p90] = last.value.values
  const chance = result.value?.goalChance
  return (
    `Éventail de ${runsLabel} trajectoires du patrimoine net jusqu’en ${last.value.label}. ` +
    `Médiane finale ${euro(p50)}, entre ${euro(p10)} et ${euro(p90)} dans 8 cas sur 10.` +
    (chance === null || chance === undefined ? '' : ` Chance d’atteindre ${euro(settings.goalAmount)} : ${percent(chance)}.`)
  )
})

const table = computed(() => ({
  columns: ['Date', 'Défavorable (10 %)', '25 %', 'Médiane', '75 %', 'Favorable (90 %)'],
  numeric: [false, true, true, true, true, true],
  rows: points.value.map((point) => [point.label, ...point.values.map((value) => euro(value))]),
}))

const contributionHint = computed(() =>
  averageIn.value === null
    ? 'Montant versé chaque mois sur tes placements (négatif pour un retrait).'
    : `Moyenne des 12 derniers mois de l’onglet inout : ${euro(averageIn.value)}.`,
)
const debtHint = computed(() =>
  start.value?.debt > 0
    ? `Dette actuelle : ${euro(start.value.debt)}. Indique la part capital de tes mensualités.`
    : 'Aucune dette dans la table portfolio.',
)
const goalHint = computed(() =>
  goals.value.length
    ? `Lu dans _history (ligne sans type d’actif). ${settings.real ? 'Compté en euros d’aujourd’hui.' : 'Compté en euros courants.'}`
    : settings.real
      ? 'Compté en euros d’aujourd’hui.'
      : 'Compté en euros courants.',
)
</script>
