<!--
  Page « Portfolio Snapshot » (/portfolio-snapshot) : où en est ton patrimoine aujourd'hui.
  Haut : patrimoine brut et net, variation de l'année et du mois, anneau des types d'actifs.
  Bas : pour chaque type d'actif, ses sous-types, instruments, enveloppes, courtiers et zones.
  Calculs dans lib/snapshot.js. La table _history ne sert qu'aux deux variations : si elle manque, la page s'affiche quand même.
-->
<template>
  <div>
    <header class="max-w-3xl">
      <h1 class="text-h2 text-ink">{{ t('pages.snapshot') }}</h1>
      <p class="mt-3 text-lead text-ink-2" aria-live="polite">{{ subtitle }}</p>
    </header>

    <div
      v-if="status === 'loading'"
      role="status"
      class="mt-10 flex h-80 items-center justify-center rounded-xl bg-wash text-ink-2 motion-safe:animate-pulse"
    >
      {{ t('snapshotPage.loading') }}
    </div>

    <div v-else-if="status === 'error'" role="alert" class="mt-10 rounded-xl border border-danger-line bg-danger-wash p-6">
      <p class="font-semibold text-danger">
        {{ missingTable ? t('page.tableMissing', { table: 'portfolio' }) : t('chartUi.loadErrorTitle') }}
      </p>
      <p class="mt-1 text-ink">
        {{
          missingTable
            ? t('page.notSyncedYet')
            : portfolio.error.value.message
        }}
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
      <!-- Vue d'ensemble -->
      <section aria-labelledby="titre-actifs" class="mt-10 rounded-xl border border-line bg-paper shadow-soft">
        <div class="border-b border-line px-4 py-4 sm:px-6">
          <h2 id="titre-actifs" class="text-h3 text-ink">
            {{ model.mode === 'net' ? t('snapshotPage.yourNetWorth') : t('snapshotPage.yourAssets') }}
          </h2>
          <!-- Montants de l'anneau et du détail : bouton Brut / Net du menu de Charts -->
          <p class="mt-1 text-sm text-ink-2">{{ amountsLine }}</p>
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
            <ul class="divide-y divide-line" :aria-label="t('snapshotPage.amountsByType')">
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

      <!-- Tes dettes (mode Brut) : par instrument, en positif -->
      <section
        v-if="model.debts.length"
        aria-labelledby="titre-dettes"
        class="mt-10 rounded-xl border border-line bg-paper p-4 shadow-soft sm:p-6"
      >
        <h2 id="titre-dettes" class="text-h3 text-ink">{{ t('snapshotPage.yourDebts') }}</h2>
        <p class="mt-1 tabular-nums text-ink-2">
          {{ t('snapshotPage.debtsTotal', { amount: euro(Math.abs(model.liabilities)) }) }}
        </p>
        <ShareBars class="mt-4 max-w-2xl" :items="model.debts" :color="DEBT_COLOR" :label="t('snapshotPage.yourDebts')" />
      </section>

      <!-- Détail par type d'actif -->
      <section aria-labelledby="titre-detail" class="mt-14">
        <h2 id="titre-detail" class="text-h3 text-ink">{{ t('snapshotPage.detailTitle') }}</h2>
        <p class="mt-2 max-w-2xl text-ink-2">
          {{ t('snapshotPage.detailLead') }}
        </p>

        <ul class="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          <li v-for="type in model.types" :key="type.name" class="rounded-xl border border-line bg-paper shadow-soft">
            <div class="border-b border-line p-4 sm:p-6">
              <h3 class="flex items-center gap-2 text-h3 text-ink">
                <span class="h-3 w-3 shrink-0 rounded-[3px]" :style="{ backgroundColor: type.color }" aria-hidden="true"></span>
                {{ type.name }}
              </h3>
              <p class="mt-1 tabular-nums text-ink-2">
                <span class="font-semibold text-ink">{{ euro(type.value) }}</span> ·
                {{ t('snapshotPage.ofWealth', { share: percent(type.share) }) }}
              </p>
              <!-- Mode net : le détail ci-dessous reste celui des actifs du type -->
              <p v-if="type.debts > 0" class="mt-1 text-sm tabular-nums text-ink-3">
                {{ t('snapshotPage.typeDebts', { amount: euro(type.debts) }) }}
              </p>
            </div>
            <div class="space-y-6 p-4 sm:p-6">
              <section v-for="dim in type.dimensions" :key="dim.key">
                <h4 class="text-sm font-semibold text-ink">{{ dim.label }}</h4>
                <ShareBars class="mt-2.5" :items="dim.items" :color="type.color" :label="t('snapshotPage.dimOf', { dim: dim.label, type: type.name })" />
              </section>
              <p v-if="!type.dimensions.length" class="text-ink-2">
                {{ t('snapshotPage.noDetail') }}
              </p>
            </div>
          </li>
        </ul>

        <p v-if="model.missing.length" class="mt-6 text-ink-2">
          {{ t('snapshotPage.noData', { types: model.missing.join(', ') }) }}
        </p>
      </section>

      <div class="mt-12 max-w-3xl space-y-1 border-t border-line pt-6 text-sm text-ink-2">
        <p v-if="model.usedColumns.length">{{ t('snapshotPage.columnsRead', { columns: model.usedColumns.join(' ; ') }) }}</p>
        <p v-if="model.missingDimensions.length">
          {{ t('snapshotPage.noColumnFor', { dims: model.missingDimensions.join(', ') }) }}
        </p>
        <i18n-t keypath="snapshotPage.footer" tag="p" scope="global">
          <template #sheet>
            <router-link to="/sheet" class="font-semibold text-accent underline underline-offset-4 hover:text-accent-hover">GoogleSheet</router-link>
          </template>
        </i18n-t>
      </div>
    </template>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { computed } from 'vue'
import AppButton from '../components/ui/AppButton.vue'
import BaseChart from '../components/charts/BaseChart.vue'
import ShareBars from '../components/charts/ShareBars.vue'
import { useTable } from '../composables/useTable.js'
import { DataError, collectDropped } from '../lib/aggregate.js'
import { amountMode, amountNote, droppedNote } from '../lib/amounts.js'
import { NEGATIVE } from '../lib/palette.js'
import { donutOption } from '../lib/charts/assetDonut.js'
import { euro, formatDateLong, percent } from '../lib/format.js'
import { buildSnapshot, signedPercent2 } from '../lib/snapshot.js'

const { t } = useI18n()

// Dettes : la couleur des baisses du site
const DEBT_COLOR = NEGATIVE

const portfolio = useTable('portfolio')
const history = useTable('_history') // facultative : sert aux variations de l'année et du mois

// Une DataError (colonne absente…) devient un message lisible ; toute autre erreur est un bug à voir en console.
const model = computed(() => {
  if (!portfolio.data.value) return null
  try {
    const [result, dropped] = collectDropped(() =>
      buildSnapshot(portfolio.data.value, history.data.value, undefined, amountMode.value),
    )
    return { ...result, dropped }
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

const subtitle = computed(() =>
  model.value?.asOf
    ? t('strategy.positionsAt', { date: formatDateLong(model.value.asOf) })
    : t('snapshotPage.defaultSubtitle'),
)

const donut = computed(() => (status.value === 'ready' ? donutOption(model.value.parts, model.value.total, model.value.mode === 'net' ? t('chart.netWorth') : t('chart.totalAssets')) : {}))

// « Montants bruts : … » ou « Montants nets : … », et les types écartés parce que négatifs en net
const amountsLine = computed(() =>
  status.value === 'ready' ? [amountNote(model.value.mode), droppedNote(model.value.dropped)].filter(Boolean).join(' ') : '',
)
const donutSummary = computed(() =>
  status.value === 'ready'
    ? t('snapshotPage.donutA11y', {
        count: model.value.legend.length,
        total: euro(model.value.total),
        biggest: model.value.legend[0].name,
        share: model.value.legend[0].share,
      })
    : '',
)

// Quatre repères : brut, net, année, mois
const kpis = computed(() => {
  if (status.value !== 'ready') return []
  const m = model.value
  const since = (change) => t('snapshotPage.since', { date: formatDateLong(change.since) })
  const missing = history.data.value
    ? t('snapshotPage.notEnough')
    : history.loading.value
      ? t('snapshotPage.loadingShort')
      : t('snapshotPage.noHistory')
  return [
    { label: t('snapshotPage.gross'), value: euro(m.gross), hint: t('chart.totalAssets') },
    {
      label: t('chart.netWorth'),
      value: euro(m.net),
      hint: m.hasLiabilities
        ? t('snapshotPage.afterDebts', { amount: euro(Math.abs(m.liabilities)) })
        : t('snapshotPage.noDebtColumn'),
    },
    {
      label: t('snapshotPage.thisYear'),
      value: m.changes.year ? signedPercent2(m.changes.year.fraction) : '–',
      hint: m.changes.year ? since(m.changes.year) : missing,
    },
    {
      label: t('snapshotPage.thisMonth'),
      value: m.changes.month ? signedPercent2(m.changes.month.fraction) : '–',
      hint: m.changes.month ? since(m.changes.month) : missing,
    },
  ]
})
</script>
