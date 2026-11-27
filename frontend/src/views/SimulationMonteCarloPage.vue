<!--
  Page « Monte Carlo » de la rubrique Simulation (/simulation, menu à gauche : SimulationLayout.vue) : simulation de
  Monte-Carlo du patrimoine net, avec la probabilité d'atteindre ton objectif. Calculs dans lib/simulation.js, exécutés dans un Web Worker (lib/simulation.worker.js).
  Point de départ lu dans la base : portfolio (montants par type d'actif et dettes), inout (versement moyen, facultatif),
  history (objectifs, facultatif). Toutes les hypothèses se modifient dans la page et sont retenues par le navigateur.
  Montants dans la devise d'affichage de l'en-tête (lib/displayCurrency.js) : les tables arrivent converties, et les
  montants retenus dans une autre devise (versement, remboursement, objectif) sont convertis au dernier taux.
-->
<template>
  <div>
    <header class="max-w-3xl">
      <h1 class="text-h2 text-ink">{{ t('pages.monteCarlo') }}</h1>
      <p class="mt-3 text-lead text-ink-2">
        {{ t('simulationPage.lead', { runs: runsLabel }) }}
      </p>
      <ConversionNote :table="portfolio.data.value" class="mt-2" />
    </header>

    <!-- Une table illisible ou des positions inutilisables : un seul encadré, « Impossible de préparer la simulation » -->
    <PageState
      :status="status"
      :error="error"
      :problem="start?.problem"
      :reload="reload"
      table="portfolio"
      kind="page"
      :loading-text="t('snapshotPage.loading')"
      :error-title="t('simulationPage.prepareError')"
    >
      <!-- Repères -->
      <section aria-labelledby="titre-resultats" class="mt-10">
        <h2 id="titre-resultats" class="sr-only">{{ t('simulationPage.results') }}</h2>
        <dl class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-live="polite">
          <div v-for="kpi in kpis" :key="kpi.label" class="rounded-xl border border-line bg-paper p-5 shadow-soft">
            <dt class="text-sm text-ink-2">{{ kpi.label }}</dt>
            <dd class="mt-1 text-2xl font-bold tabular-nums" :class="kpi.tone || 'text-ink'">{{ kpi.value }}</dd>
            <dd class="mt-1 text-sm text-ink-3">{{ kpi.hint }}</dd>
          </div>
        </dl>
      </section>

      <!-- Éventail -->
      <section class="mt-8 rounded-xl border border-line bg-paper shadow-soft" aria-labelledby="titre-eventail">
        <header class="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-b border-line px-4 py-4 sm:px-6">
          <div class="min-w-0">
            <h2 id="titre-eventail" class="text-h3 text-ink">{{ t('simulationPage.fanTitle') }}</h2>
            <p class="mt-1 text-ink-2">
              {{ settings.real ? t('simulationPage.realNote', { currency: currencyLabel() }) : t('simulationPage.nominalNote', { currency: currencyLabel() }) }}
              <span v-if="computing" class="ml-1 text-ink-3">{{ t('simulationPage.computing') }}</span>
            </p>
          </div>
          <div class="flex flex-wrap gap-3">
            <SegmentedControl v-model="unit" :options="UNITS" :label="t('simulationPage.unit')" />
            <SegmentedControl v-model="view" :options="VIEWS" :label="t('chartUi.display')" />
          </div>
        </header>
        <div class="p-4 sm:p-6">
          <div v-if="!result" role="status" class="flex h-80 items-center justify-center rounded-lg bg-wash text-ink-2 motion-safe:animate-pulse">
            {{ t('simulationPage.computingRuns', { runs: runsLabel }) }}
          </div>
          <template v-else>
            <DataTableView
              v-if="view === 'table'"
              :columns="table.columns"
              :rows="table.rows"
              :numeric="table.numeric"
              :caption="t('simulationPage.tableCaption')"
            />
            <BaseChart v-else :option="option" :height="420" :min-width="560" :label="summary" />
            <p class="mt-4 text-sm text-ink-2">
              {{ t('simulationPage.fanHelp') }}
            </p>
          </template>
        </div>
      </section>

      <!-- Hypothèses -->
      <section class="mt-8 rounded-xl border border-line bg-paper shadow-soft" aria-labelledby="titre-hypotheses">
        <header class="flex flex-wrap items-start justify-between gap-4 border-b border-line px-4 py-4 sm:px-6">
          <div>
            <h2 id="titre-hypotheses" class="text-h3 text-ink">{{ t('simulationPage.assumptions') }}</h2>
            <p class="mt-1 text-ink-2">
              {{ t('simulationPage.startPoint', { date: startLabel }) }}
            </p>
          </div>
          <AppButton variant="secondary" size="sm" @click="resetSettings">{{ t('simulationPage.reset') }}</AppButton>
        </header>

        <div class="grid gap-x-6 gap-y-5 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
          <NumberField id="sim-versement" v-model="settings.contribution" :label="t('simulationPage.contribution')" :suffix="currencySymbol()" :step="50" :hint="contributionHint" />
          <NumberField id="sim-hausse" v-model="settings.contributionGrowth" :label="t('simulationPage.contributionGrowth')" :suffix="t('simulationPage.perYear')" :step="0.5" :hint="t('simulationPage.contributionGrowthHint')" />
          <NumberField id="sim-pret" v-model="settings.debtPayment" :label="t('simulationPage.debtPayment')" :suffix="t('simulationPage.perMonth', { currency: currencySymbol() })" :step="50" :hint="debtHint" />
          <NumberField id="sim-objectif" v-model="settings.goalAmount" :label="t('simulationPage.goalAmount')" :suffix="currencySymbol()" :step="10000" :hint="goalHint" />
          <div>
            <label for="sim-date" class="block text-sm font-medium text-ink">{{ t('simulationPage.goalDate') }}</label>
            <input
              id="sim-date"
              v-model="settings.goalDate"
              type="date"
              class="mt-1 w-full rounded-lg border border-line-strong bg-paper px-3 py-2 text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
            <p class="mt-1 text-sm text-ink-3">{{ t('simulationPage.goalDateHint') }}</p>
          </div>
          <NumberField id="sim-frais" v-model="settings.fees" :label="t('simulationPage.fees')" suffix="%" :step="0.05" :hint="t('simulationPage.feesHint')" />
          <NumberField id="sim-inflation" v-model="settings.inflation" :label="t('simulationPage.inflation')" :suffix="t('simulationPage.perYear')" :step="0.1" :hint="t('simulationPage.inflationHint', { currency: currencyLabel() })" />
          <div class="flex items-start gap-3 sm:col-span-2 lg:col-span-2">
            <input id="sim-queues" v-model="settings.fatTails" type="checkbox" class="mt-1 h-4 w-4 accent-accent" />
            <label for="sim-queues" class="text-ink">
              {{ t('simulationPage.fatTails') }}
              <span class="block text-sm text-ink-3">
                {{ t('simulationPage.fatTailsHint') }}
              </span>
            </label>
          </div>
        </div>

        <div class="border-t border-line p-4 sm:p-6">
          <h3 class="font-semibold text-ink">{{ t('simulationPage.byType') }}</h3>
          <p class="mt-1 max-w-3xl text-sm text-ink-2">
            {{ t('simulationPage.byTypeHelp') }}
          </p>
          <div class="mt-4 overflow-x-auto">
            <table class="w-full min-w-[640px] text-left text-sm">
              <thead class="border-b border-line text-ink-2">
                <tr>
                  <th scope="col" class="py-2 pr-4 font-medium">{{ t('simulationPage.cols.type') }}</th>
                  <th scope="col" class="py-2 pr-4 text-right font-medium">{{ t('simulationPage.cols.amount') }}</th>
                  <th scope="col" class="py-2 pr-4 font-medium">{{ t('simulationPage.cols.return') }}</th>
                  <th scope="col" class="py-2 pr-4 font-medium">{{ t('simulationPage.cols.volatility') }}</th>
                  <th scope="col" class="py-2 pr-4 font-medium">{{ t('simulationPage.cols.link') }}</th>
                  <th scope="col" class="py-2 font-medium">{{ t('simulationPage.cols.invest') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="asset in assetRows" :key="asset.name" class="border-b border-line last:border-0">
                  <th scope="row" class="py-2 pr-4 font-medium text-ink">{{ asset.label }}</th>
                  <td class="py-2 pr-4 text-right tabular-nums text-ink">{{ formatAmount(asset.amount) }}</td>
                  <td class="py-2 pr-4">
                    <input v-model.number="settings.assets[asset.name].mu" type="number" step="0.5" :aria-label="t('simulationPage.a11y.return', { asset: asset.label })" :class="cellInput" />
                  </td>
                  <td class="py-2 pr-4">
                    <input v-model.number="settings.assets[asset.name].sigma" type="number" step="1" min="0" :aria-label="t('simulationPage.a11y.volatility', { asset: asset.label })" :class="cellInput" />
                  </td>
                  <td class="py-2 pr-4">
                    <input v-model.number="settings.assets[asset.name].rho" type="number" step="0.05" min="-1" max="1" :aria-label="t('simulationPage.a11y.link', { asset: asset.label })" :class="cellInput" />
                  </td>
                  <td class="py-2">
                    <input v-model="settings.assets[asset.name].invest" type="checkbox" class="h-4 w-4 accent-accent" :aria-label="t('simulationPage.a11y.invest', { asset: asset.label })" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section class="mt-8 max-w-3xl text-ink-2" aria-labelledby="titre-limites">
        <h2 id="titre-limites" class="text-h3 text-ink">{{ t('simulationPage.limitsTitle') }}</h2>
        <ul class="mt-3 list-disc space-y-1 pl-5">
          <li v-for="limit in tList('simulationPage.limits')" :key="limit">{{ limit }}</li>
        </ul>
        <p class="mt-4 text-sm">{{ t('simulationPage.notAdvice') }}</p>
      </section>
    </PageState>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { tList } from '../i18n/index.js'
import { computed, defineComponent, h, onBeforeUnmount, reactive, ref, watch } from 'vue'
import AppButton from '../components/ui/AppButton.vue'
import PageState from '../components/PageState.vue'
import SegmentedControl from '../components/ui/SegmentedControl.vue'
import BaseChart from '../components/charts/BaseChart.vue'
import DataTableView from '../components/charts/DataTableView.vue'
import { usePageModel } from '../composables/usePageModel.js'
import { DataError } from '../lib/aggregate.js'
import { fanOption } from '../lib/charts/simulationFan.js'
import { capitalize, currencyLabel, currencySymbol, formatAmount, formatDateLong, formatMonthYear, formatNumber, percent } from '../lib/format.js'
import { convertLatest, displayCurrency } from '../lib/displayCurrency.js'
import ConversionNote from '../components/ConversionNote.vue'
import { assumptionFor, averageContribution, monthsBetween, readGoals, readPortfolio } from '../lib/simulation.js'
import { readPreference, writePreference } from '../lib/preferences.js'

const { t } = useI18n()

const RUNS = 5000
const UNITS = [
  { value: 'real', label: t('simulationPage.units.real') },
  { value: 'nominal', label: t('simulationPage.units.nominal') },
]
const VIEWS = [
  { value: 'chart', label: t('chartUi.chart') },
  { value: 'table', label: t('chartUi.table') },
]
const cellInput =
  'w-24 rounded-md border border-line-strong bg-paper px-2 py-1 text-right tabular-nums text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent'
const runsLabel = formatNumber(RUNS)

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
              'w-full rounded-lg border border-line-strong bg-paper px-3 py-2 text-right tabular-nums text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
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

// Positions de portfolio (obligatoire) ; inout et history (facultatives) donnent le versement et l'objectif proposés :
// la page attend leur réponse avant de se préparer
const {
  status,
  model: start,
  error,
  tables,
  reload,
} = usePageModel({
  required: ['portfolio'],
  optional: ['inout', 'history'],
  waitOptional: true,
  failedKey: 'simulationPage.readFailed',
  build: ({ portfolio }) => {
    const read = readPortfolio(portfolio)
    if (!read.assets.length) throw new DataError(t('simulationPage.noPositive'))
    return { ...read, date: read.date || new Date().toISOString().slice(0, 10) }
  },
})
const { portfolio, inout, history } = tables
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
    real: false, // les objectifs de la feuille sont en monnaie courante
    currency: displayCurrency.value, // devise des montants ci-dessous
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
    const saved = JSON.parse(readPreference('simulation') ?? 'null')
    if (saved && typeof saved === 'object') {
      convertSaved(saved)
      for (const key of Object.keys(base)) if (key !== 'assets' && saved[key] !== undefined) base[key] = saved[key]
      for (const name of Object.keys(base.assets)) if (saved.assets?.[name]) Object.assign(base.assets[name], saved.assets[name])
    }
  } catch {
    // stockage indisponible ou illisible : valeurs par défaut
  }
  Object.assign(settings, base)
  unit.value = settings.real ? 'real' : 'nominal'
}

// Montants retenus dans une autre devise (avant un changement dans l'en-tête ; anciens réglages : euros) :
// convertis au dernier taux ; sans taux, les valeurs par défaut les remplacent.
const MONEY_SETTINGS = ['contribution', 'debtPayment', 'goalAmount']
function convertSaved(saved) {
  const from = typeof saved.currency === 'string' ? saved.currency : 'EUR'
  const to = displayCurrency.value
  if (from !== to) {
    for (const key of MONEY_SETTINGS) {
      const value = saved[key] === undefined ? null : convertLatest(saved[key], from, to)
      if (value === null) delete saved[key]
      else saved[key] = Math.round(value)
    }
  }
  saved.currency = to
}

function resetSettings() {
  writePreference('simulation', null)
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
    if (settings.goalDate) writePreference('simulation', JSON.stringify(settings))
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
  const unitText = t(settings.real ? 'simulationPage.realUnitText' : 'simulationPage.nominalUnitText', { currency: currencyLabel() })
  return [
    {
      label: t('simulationPage.kpi.chance'),
      value: chance === null ? '–' : percent(chance),
      hint:
        chance === null
          ? t('simulationPage.kpi.chooseGoal')
          : t('simulationPage.kpi.goalAt', { amount: formatAmount(settings.goalAmount), date: goalLabel.value }),
      tone: chance === null ? '' : chance >= 0.75 ? 'text-success' : chance < 0.4 ? 'text-danger' : 'text-ink',
    },
    {
      label: t('simulationPage.kpi.medianIn', { date: last.value.label }),
      value: formatAmount(p50),
      hint: t('simulationPage.kpi.medianHint', { unit: unitText }),
    },
    { label: t('simulationPage.kpi.poor'), value: formatAmount(p10), hint: t('simulationPage.kpi.poorHint') },
    { label: t('simulationPage.kpi.good'), value: formatAmount(p90), hint: t('simulationPage.kpi.goodHint') },
  ]
})

const summary = computed(() => {
  if (!last.value) return t('simulationPage.summaryDefault')
  const [p10, , p50, , p90] = last.value.values
  const chance = result.value?.goalChance
  return (
    t('simulationPage.summary', { runs: runsLabel, date: last.value.label, median: formatAmount(p50), p10: formatAmount(p10), p90: formatAmount(p90) }) +
    (chance === null || chance === undefined
      ? ''
      : ` ${t('simulationPage.summaryChance', { amount: formatAmount(settings.goalAmount), chance: percent(chance) })}`)
  )
})

const table = computed(() => ({
  columns: [
    t('chart.date'),
    t('simulationPage.table.poor'),
    t('simulationPage.table.p25'),
    t('simulation.median'),
    t('simulationPage.table.p75'),
    t('simulationPage.table.good'),
  ],
  numeric: [false, true, true, true, true, true],
  rows: points.value.map((point) => [point.label, ...point.values.map((value) => formatAmount(value))]),
}))

const contributionHint = computed(() =>
  averageIn.value === null
    ? t('simulationPage.hint.contributionDefault')
    : t('simulationPage.hint.contributionAverage', { amount: formatAmount(averageIn.value) }),
)
const debtHint = computed(() =>
  start.value?.debt > 0
    ? t('simulationPage.hint.debt', { amount: formatAmount(start.value.debt) })
    : t('simulationPage.hint.noDebt'),
)
const goalHint = computed(() =>
  goals.value.length
    ? t('simulationPage.hint.goalFromHistory', { unit: t(settings.real ? 'simulationPage.hint.real' : 'simulationPage.hint.nominal', { currency: currencyLabel() }) })
    : t(settings.real ? 'simulationPage.hint.real' : 'simulationPage.hint.nominal', { currency: currencyLabel() }),
)
</script>
