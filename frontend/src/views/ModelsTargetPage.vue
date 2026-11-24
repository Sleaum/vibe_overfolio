<!--
  Page « Target » de la rubrique Models (/modeles/target, menu à gauche : ModelsLayout.vue).
  1. Ta cible : année visée, catégories (tes types d'actifs ou les classes des modèles), versement mensuel (par défaut
     la moyenne des 12 derniers mois de inout), un pourcentage par catégorie (curseur et champ), total à 100 %.
     Gardée sur le profil (lib/modelTarget.js, PUT /api/profile/ {"model_target"}), retrouvée sur tous tes appareils.
  2. Aujourd'hui et ta cible : deux camemberts (lib/charts/targetPie.js) et le tableau des écarts. Brut ou net selon
     le bouton du menu de gauche.
  3. Plan d'actions, année par année : où placer tes versements, et ce qu'il faudrait vendre la dernière année si
     les versements ne suffisent pas (lib/target.js, buildPlan). Sans rendement, montants d'aujourd'hui.
-->
<template>
  <div>
    <header class="max-w-3xl">
      <h1 class="text-h2 text-ink">{{ t('pages.modelsTarget') }}</h1>
      <p class="mt-3 text-lead text-ink-2">{{ t('targetPage.lead') }}</p>
      <p class="mt-2 text-sm text-ink-3">{{ t('modelsPage.disclaimer') }}</p>
    </header>

    <!-- 1. Ta cible -->
    <section aria-labelledby="titre-cible" class="mt-10 rounded-xl border border-line bg-paper shadow-soft">
      <div class="border-b border-line px-4 py-4 sm:px-6">
        <h2 id="titre-cible" class="text-h3 text-ink">{{ t('targetPage.settings.title') }}</h2>
        <p class="mt-1 text-sm text-ink-2">{{ t('targetPage.settings.lead') }}</p>
      </div>

      <div class="grid gap-5 border-b border-line p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-[auto_auto_minmax(0,1fr)]">
        <div>
          <label for="cible-annee" class="block text-sm font-medium text-ink">{{ t('targetPage.settings.year') }}</label>
          <input
            id="cible-annee"
            type="number"
            :min="thisYear + 1"
            max="2100"
            step="1"
            :value="target.year"
            :class="[field, 'mt-1 w-28']"
            @change="setYear($event.target.value)"
          />
        </div>
        <div>
          <p class="text-sm font-medium text-ink">{{ t('targetPage.settings.basis') }}</p>
          <SegmentedControl class="mt-1" :model-value="target.basis" :options="basisOptions" :label="t('targetPage.settings.basis')" @update:model-value="setBasis" />
        </div>
        <div class="sm:col-span-2 lg:col-span-1">
          <label for="cible-versement" class="block text-sm font-medium text-ink">{{ t('targetPage.settings.monthly', { currency: currencyLabel() }) }}</label>
          <input
            id="cible-versement"
            type="number"
            min="0"
            step="50"
            :value="target.monthly ?? ''"
            :placeholder="suggested != null ? String(Math.round(suggested)) : '0'"
            :class="[field, 'mt-1 w-40']"
            @change="setMonthly($event.target.value)"
          />
          <p class="mt-1 text-xs text-ink-3">
            {{ suggested != null ? t('targetPage.settings.monthlyHint', { amount: formatAmount(suggested) }) : t('targetPage.settings.monthlyNone') }}
          </p>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 sm:px-6">
        <AppButton variant="secondary" size="sm" :disabled="!current" @click="startFromCurrent">{{ t('targetPage.settings.fromCurrent') }}</AppButton>
        <template v-if="target.basis === 'classes'">
          <label for="cible-modele" class="sr-only">{{ t('targetPage.settings.fromModel') }}</label>
          <select id="cible-modele" :class="[field, 'w-auto py-1.5 text-sm']" @change="startFromModel($event)">
            <option value="">{{ t('targetPage.settings.fromModel') }}</option>
            <option v-for="model in MODELS" :key="model.key" :value="model.key">{{ model.name }}</option>
          </select>
        </template>
        <button type="button" class="ml-auto rounded-md px-2 py-1 text-sm text-ink-2 underline-offset-4 hover:text-ink hover:underline" @click="clearTarget">
          {{ t('targetPage.settings.clear') }}
        </button>
      </div>

      <!-- Un pourcentage par catégorie -->
      <ul class="divide-y divide-line" :aria-label="t('targetPage.settings.title')">
        <li v-for="row in rows" :key="row.key" class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-2.5 sm:grid-cols-[12rem_5rem_minmax(0,1fr)_6rem] sm:px-6">
          <span class="flex min-w-0 items-center gap-2 text-ink">
            <span class="h-3 w-3 shrink-0 rounded-[3px]" :style="{ backgroundColor: row.color }" aria-hidden="true"></span>
            <span class="truncate">{{ row.label }}</span>
          </span>
          <span class="text-right text-sm tabular-nums text-ink-3 sm:text-left">
            <span class="sr-only">{{ t('targetPage.today') }} :</span>{{ current ? `${formatDecimal(row.today)} %` : '–' }}
          </span>
          <!-- Mobile : curseur et champ sur une même ligne ; à partir de 640 px, chacun dans sa colonne -->
          <div class="col-span-2 flex items-center gap-3 sm:contents">
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            :value="row.target"
            class="min-w-0 flex-1 accent-accent sm:w-full"
            :aria-label="t('targetPage.settings.sliderA11y', { name: row.label })"
            @input="setShare(row.key, $event.target.value)"
          />
          <span class="flex shrink-0 items-center gap-1">
            <input
              type="number"
              min="0"
              max="100"
              step="0.5"
              :value="row.target"
              :class="[field, 'w-20 py-1 text-right tabular-nums']"
              :aria-label="t('targetPage.settings.inputA11y', { name: row.label })"
              @change="setShare(row.key, $event.target.value)"
            />
            <span class="text-ink-2">%</span>
          </span>
          </div>
        </li>
      </ul>

      <div class="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6" aria-live="polite">
        <p class="font-semibold tabular-nums" :class="balanced ? 'text-success' : 'text-danger'">
          {{ t('targetPage.total', { sum: formatDecimal(sum) }) }}
          <span v-if="!balanced" class="font-normal">
            · {{ sum < 100 ? t('targetPage.missing', { points: formatDecimal(100 - sum) }) : t('targetPage.over', { points: formatDecimal(sum - 100) }) }}
          </span>
        </p>
        <AppButton v-if="!balanced && sum > 0" variant="secondary" size="sm" @click="normalize">{{ t('targetPage.normalize') }}</AppButton>
        <p v-if="targetError" class="text-sm text-danger">{{ t('targetPage.saveError', { message: targetError }) }}</p>
      </div>
    </section>

    <!-- 2. Aujourd'hui et ta cible -->
    <section aria-labelledby="titre-ecarts" class="mt-10 rounded-xl border border-line bg-paper shadow-soft">
      <div class="border-b border-line px-4 py-4 sm:px-6">
        <h2 id="titre-ecarts" class="text-h3 text-ink">{{ t('targetPage.compare.title') }}</h2>
        <p v-if="current" class="mt-1 text-sm text-ink-3">{{ amountNote(amountMode) }}</p>
      </div>
      <div v-if="!portfolio.data.value && !portfolio.error.value" role="status" class="m-4 h-40 rounded-lg bg-wash motion-safe:animate-pulse sm:m-6">
        <span class="sr-only">{{ t('modelsPage.compare.loading') }}</span>
      </div>
      <p v-else-if="!current" class="px-4 py-6 text-ink-2 sm:px-6">{{ t('targetPage.compare.noData') }}</p>
      <template v-else>
        <div class="grid gap-4 p-4 sm:p-6 md:grid-cols-2">
          <BaseChart :option="todayPie" :height="260" :label="pieLabel(todaySlices)" />
          <BaseChart v-if="sum > 0" :option="targetPie" :height="260" :label="pieLabel(targetSlices)" />
          <p v-else class="flex items-center justify-center rounded-lg bg-wash p-6 text-center text-sm text-ink-2">{{ t('targetPage.compare.emptyTarget') }}</p>
        </div>
        <div class="overflow-x-auto border-t border-line">
          <table class="w-full min-w-[36rem] border-collapse text-sm">
            <caption class="sr-only">{{ t('targetPage.compare.tableCaption') }}</caption>
            <thead>
              <tr class="border-b border-line-strong text-left text-xs font-semibold text-ink-3">
                <th scope="col" class="px-4 py-3 sm:px-6">{{ t('targetPage.compare.columns.category') }}</th>
                <th scope="col" class="px-3 py-3 text-right">{{ t('targetPage.compare.columns.today') }}</th>
                <th scope="col" class="px-3 py-3 text-right">{{ t('targetPage.compare.columns.target') }}</th>
                <th scope="col" class="px-3 py-3 text-right">{{ t('targetPage.compare.columns.gap') }}</th>
                <th scope="col" class="px-4 py-3 text-right sm:px-6">{{ t('targetPage.compare.columns.move') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in gapRows" :key="row.key" class="border-b border-line last:border-b-0">
                <th scope="row" class="px-4 py-2.5 text-left font-medium text-ink sm:px-6">
                  <span class="flex items-center gap-2">
                    <span class="h-2.5 w-2.5 shrink-0 rounded-sm" :style="{ backgroundColor: row.color }" aria-hidden="true"></span>
                    {{ row.label }}
                  </span>
                </th>
                <td class="px-3 py-2.5 text-right tabular-nums text-ink">{{ formatDecimal(row.today) }} %</td>
                <td class="px-3 py-2.5 text-right tabular-nums text-ink">{{ formatDecimal(row.target) }} %</td>
                <td class="px-3 py-2.5 text-right tabular-nums" :class="Math.abs(row.gap) <= TOLERANCE ? 'text-ink-3' : 'text-ink'">{{ signedPoints(row.gap) }}</td>
                <td class="px-4 py-2.5 text-right tabular-nums sm:px-6" :class="row.move < 0 ? 'text-danger' : 'text-ink'">{{ signedAmount(row.move) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="px-4 py-3 text-xs text-ink-3 sm:px-6">{{ t('targetPage.compare.moveHint') }}</p>
      </template>
    </section>

    <!-- 3. Plan d'actions -->
    <section aria-labelledby="titre-plan" class="mt-10 rounded-xl border border-line bg-paper shadow-soft">
      <div class="border-b border-line px-4 py-4 sm:px-6">
        <h2 id="titre-plan" class="text-h3 text-ink">{{ t('targetPage.plan.title', { year: target.year }) }}</h2>
        <p class="mt-1 text-sm text-ink-2">{{ t('targetPage.plan.lead', { amount: formatAmount(monthly) }) }}</p>
      </div>
      <p v-if="!current" class="px-4 py-6 text-ink-2 sm:px-6">{{ t('targetPage.compare.noData') }}</p>
      <p v-else-if="!balanced" class="px-4 py-6 text-ink-2 sm:px-6">{{ t('targetPage.plan.invalidSum') }}</p>
      <template v-else-if="plan">
        <p class="px-4 pt-4 font-semibold sm:px-6" :class="plan.reachedYear !== null ? 'text-success' : 'text-ink'">{{ planSummary }}</p>
        <!-- Une ligne par année, une colonne par catégorie : + à verser ou acheter, − à vendre -->
        <div v-if="planSteps.length" class="mt-3 overflow-x-auto">
          <table class="w-full border-collapse text-sm" :style="{ minWidth: `${10 + planColumns.length * 8}rem` }">
            <caption class="sr-only">{{ t('targetPage.plan.tableCaption') }}</caption>
            <thead>
              <tr class="border-y border-line-strong text-left text-xs font-semibold text-ink-3">
                <th scope="col" class="px-4 py-2.5 sm:px-6">{{ t('targetPage.plan.year') }}</th>
                <th v-for="col in planColumns" :key="col.key" scope="col" class="px-3 py-2.5 text-right">
                  <span class="inline-flex items-center gap-1.5">
                    <span class="h-2.5 w-2.5 shrink-0 rounded-sm" :style="{ backgroundColor: col.color }" aria-hidden="true"></span>
                    {{ col.label }}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="step in planSteps" :key="step.year" class="border-b border-line last:border-b-0">
                <th scope="row" class="px-4 py-2 text-left font-semibold tabular-nums text-ink sm:px-6">{{ step.year }}</th>
                <td v-for="col in planColumns" :key="col.key" class="px-3 py-2 text-right tabular-nums" :class="step.cells[col.key]?.sell ? 'text-danger' : 'text-ink'">
                  <span v-if="step.cells[col.key]" :title="step.cells[col.key].text">{{ step.cells[col.key].short }}</span>
                  <span v-else class="text-ink-3" aria-hidden="true">·</span>
                </td>
              </tr>
            </tbody>
          </table>
          <p class="px-4 pt-3 text-xs text-ink-3 sm:px-6">{{ t('targetPage.plan.legend') }}</p>
        </div>
        <p v-if="!planSteps.length" class="px-4 py-4 text-ink-2 sm:px-6">{{ t('targetPage.plan.nothing') }}</p>
        <p class="border-t border-line px-4 py-3 text-xs text-ink-3 sm:px-6">{{ t('targetPage.plan.assumption') }}</p>
      </template>
    </section>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AppButton from '../components/ui/AppButton.vue'
import SegmentedControl from '../components/ui/SegmentedControl.vue'
import BaseChart from '../components/charts/BaseChart.vue'
import { useTable } from '../composables/useTable.js'
import { amountMode, amountNote } from '../lib/amounts.js'
import { targetPieOption } from '../lib/charts/targetPie.js'
import { capitalize, currencyLabel, formatAmount, formatDecimal } from '../lib/format.js'
import { MODELS, modelColors } from '../lib/models.js'
import { clearTarget, modelTarget, targetError, updateTarget } from '../lib/modelTarget.js'
import { CONTEXT, assignAssetColors } from '../lib/palette.js'
import { averageContribution } from '../lib/simulation.js'
import { BASES, OTHER, TOLERANCE, buildPlan, categories, currentAmounts, targetSum } from '../lib/target.js'

const { t } = useI18n()

const field =
  'rounded-lg border border-line-strong bg-paper px-3 py-2 text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent'
const thisYear = new Date().getFullYear()

const portfolio = useTable('portfolio')
const inout = useTable('inout') // facultative : versement mensuel proposé

const target = computed(() => modelTarget.value)
const basis = computed(() => target.value.basis)
const shares = computed(() => target.value[basis.value] ?? {})
const sum = computed(() => Math.round(targetSum(shares.value) * 100) / 100)
const balanced = computed(() => Math.abs(sum.value - 100) < 0.01)

const basisOptions = computed(() => BASES.map((value) => ({ value, label: t(`targetPage.settings.bases.${value}`) })))

// Aujourd'hui : montants par catégorie (brut ou net selon le menu de gauche)
const current = computed(() => currentAmounts(portfolio.data.value, basis.value, amountMode.value))
const keys = computed(() => {
  const held = Object.keys(current.value?.amounts ?? {}).filter((key) => current.value.amounts[key] > 0)
  const list = categories(basis.value, held)
  // Une catégorie de la cible absente de la liste (type d'une autre feuille) reste visible
  return [...list, ...Object.keys(shares.value).filter((key) => !list.includes(key))]
})

const colors = computed(() => {
  if (basis.value === 'classes') return { ...modelColors().classes, [OTHER]: CONTEXT }
  const { colors: map } = assignAssetColors(keys.value)
  return Object.fromEntries(keys.value.map((key) => [key, map.get(key)?.color ?? CONTEXT]))
})

function labelOf(key) {
  if (basis.value === 'classes') return key === OTHER ? t('targetPage.other') : t(`modelsPage.classes.${key}`)
  return capitalize(current.value?.names[key] ?? key)
}
function shortOf(key) {
  if (basis.value === 'classes') return key === OTHER ? t('targetPage.other') : t(`modelsPage.short.${key}`)
  return labelOf(key)
}

const todayShare = (key) => (current.value ? ((current.value.amounts[key] ?? 0) / current.value.total) * 100 : 0)

const rows = computed(() =>
  keys.value.map((key) => ({ key, label: labelOf(key), color: colors.value[key], today: todayShare(key), target: Number(shares.value[key] ?? 0) })),
)

// Réglages (enregistrés sur le profil peu après chaque changement)
const clamp = (value, low, high) => Math.min(high, Math.max(low, value))
function setShare(key, raw) {
  const value = clamp(Math.round(Number(raw) * 2) / 2 || 0, 0, 100)
  updateTarget({ [basis.value]: { ...shares.value, [key]: value } })
}
function setBasis(value) {
  updateTarget({ basis: value })
}
function setYear(raw) {
  const year = Math.round(Number(raw))
  if (Number.isFinite(year)) updateTarget({ year: clamp(year, thisYear + 1, 2100) })
}
function setMonthly(raw) {
  const text = String(raw).trim()
  updateTarget({ monthly: text === '' ? null : Math.max(0, Math.round(Number(text) || 0)) })
}

/** Pourcentages arrondis au demi-point, la somme ramenée à 100 sur la plus grosse catégorie. */
function toHundred(values) {
  const total = Object.values(values).reduce((s, v) => s + v, 0)
  if (!(total > 0)) return {}
  const out = Object.fromEntries(Object.entries(values).filter(([, v]) => v > 0).map(([k, v]) => [k, Math.round((v / total) * 200) / 2]))
  const biggest = Object.keys(out).sort((a, b) => out[b] - out[a])[0]
  if (biggest) out[biggest] = Math.round((out[biggest] + 100 - Object.values(out).reduce((s, v) => s + v, 0)) * 2) / 2
  return out
}
function normalize() {
  updateTarget({ [basis.value]: toHundred(shares.value) })
}
function startFromCurrent() {
  if (current.value) updateTarget({ [basis.value]: toHundred(current.value.amounts) })
}
function startFromModel(event) {
  const model = MODELS.find((m) => m.key === event.target.value)
  event.target.value = ''
  if (!model) return
  const values = {}
  for (const [cls, value] of model.allocation) values[cls] = (values[cls] ?? 0) + value
  updateTarget({ classes: toHundred(values) })
}

// Versement mensuel : celui saisi, sinon la moyenne des 12 derniers mois de inout
const suggested = computed(() => {
  try {
    return averageContribution(inout.data.value)
  } catch {
    return null // inout absente ou sans les colonnes attendues
  }
})
const monthly = computed(() => Math.max(0, target.value.monthly ?? suggested.value ?? 0))

// 2. Camemberts et écarts
const todaySlices = computed(() =>
  keys.value.map((key) => ({ name: labelOf(key), short: shortOf(key), value: todayShare(key), amount: current.value?.amounts[key] ?? 0, color: colors.value[key] })),
)
const targetSlices = computed(() =>
  keys.value.map((key) => ({ name: labelOf(key), short: shortOf(key), value: Number(shares.value[key] ?? 0), color: colors.value[key] })),
)
const todayPie = computed(() => targetPieOption(todaySlices.value, t('targetPage.today')))
const targetPie = computed(() => targetPieOption(targetSlices.value, t('targetPage.compare.target', { year: target.value.year })))
const pieLabel = (slices) =>
  slices
    .filter((s) => s.value > 0)
    .map((s) => t('modelsPage.sliceTitle', { label: s.name, value: formatDecimal(Math.round(s.value * 10) / 10) }))
    .join(', ')

const gapRows = computed(() =>
  rows.value
    .filter((row) => row.today > 0.05 || row.target > 0)
    .map((row) => ({ ...row, gap: row.target - row.today, move: ((row.target - row.today) / 100) * (current.value?.total ?? 0) })),
)

const signedPoints = (value) => {
  const text = t('targetPage.points', { points: formatDecimal(Math.abs(Math.round(value * 10) / 10)) })
  return Math.abs(value) < 0.05 ? text : `${value > 0 ? '+' : '−'}${text}`
}
const signedAmount = (value) => (Math.abs(value) < 0.5 ? '–' : `${value > 0 ? '+' : '−'}${formatAmount(Math.abs(value))}`)

// 3. Plan d'actions
const plan = computed(() => {
  if (!current.value || !balanced.value) return null
  return buildPlan({ amounts: current.value.amounts, target: shares.value, monthly: monthly.value, fromYear: thisYear, toYear: target.value.year })
})

// Une ligne par année où il y a quelque chose à faire ; dans chaque case, + (verser, acheter) ou − (vendre)
const planSteps = computed(() =>
  (plan.value?.steps ?? [])
    .map((step) => {
      const cells = {}
      const rebalance = Object.keys(step.sells).length > 0
      for (const [key, amount] of Object.entries(step.buys)) {
        if (amount < 1) continue
        cells[key] = {
          sell: false,
          short: `+${formatAmount(amount)}`,
          text: t(rebalance ? 'targetPage.plan.buyBack' : 'targetPage.plan.buy', { amount: formatAmount(amount), name: labelOf(key) }),
        }
      }
      for (const [key, amount] of Object.entries(step.sells)) {
        if (amount < 1) continue
        cells[key] = { sell: true, short: `−${formatAmount(amount)}`, text: t('targetPage.plan.sell', { amount: formatAmount(amount), name: labelOf(key) }) }
      }
      return { year: step.year, cells }
    })
    .filter((step) => Object.keys(step.cells).length),
)
const planColumns = computed(() => {
  const used = new Set(planSteps.value.flatMap((step) => Object.keys(step.cells)))
  return keys.value.filter((key) => used.has(key)).map((key) => ({ key, label: labelOf(key), color: colors.value[key] ?? CONTEXT }))
})

const planSummary = computed(() => {
  const p = plan.value
  if (!p) return ''
  if (p.reachedYear === thisYear) return t('targetPage.plan.already')
  if (p.reachedYear !== null) return t('targetPage.plan.reached', { year: p.reachedYear })
  return t('targetPage.plan.needSales', { year: target.value.year })
})
</script>
