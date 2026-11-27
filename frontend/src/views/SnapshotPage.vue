<!--
  Page « Portfolio Snapshot » (/portfolio-snapshot) : où en est ton patrimoine aujourd'hui.
  Haut : variation de l'année, du mois et sur 24 h, anneau des types d'actifs ; puis la variation des prix
  par sous-type sur les périodes choisies (lib/charts/subAssetPerformance.js).
  Bas : pour chaque type d'actif, ses sous-types, instruments, enveloppes, courtiers et zones.
  Calculs dans lib/snapshot.js. Les deux variations vont du dernier relevé de history avant le 1er janvier / le 1er du mois
  (de la date des positions) jusqu'à portfolio ; si history manque, la page s'affiche quand même. La variation sur 24 h
  part du total de portfolio gardé par le serveur la veille (previous_day, backend googlesheet/daily.py).
-->
<template>
  <div>
    <header class="max-w-3xl">
      <h1 class="text-h2 text-ink">{{ t('pages.snapshot') }}</h1>
      <p class="mt-3 text-lead text-ink-2" aria-live="polite">{{ subtitle }}</p>
      <ConversionNote :table="portfolio.data.value" class="mt-2" testid="snapshot-converted" />
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
      :loading-text="t('snapshotPage.loading')"
    >
      <!-- Vue d'ensemble -->
      <section aria-labelledby="titre-actifs" class="mt-10 rounded-xl border border-line bg-paper shadow-soft">
        <div class="border-b border-line px-4 py-4 sm:px-6">
          <h2 id="titre-actifs" class="text-h3 text-ink">{{ t('snapshotPage.yourWealth') }}</h2>
          <!-- Montants de l'anneau et du détail : bouton Brut / Net du menu de Charts -->
          <p class="mt-1 text-sm text-ink-2">{{ amountsLine }}</p>
        </div>

        <div class="grid grid-cols-12 gap-y-8 p-4 sm:p-6 lg:gap-x-8">
          <dl class="col-span-12 grid grid-cols-1 gap-4 sm:grid-cols-3 lg:col-span-3 lg:grid-cols-1 lg:content-center">
            <div v-for="kpi in kpis" :key="kpi.label" class="rounded-lg border border-line bg-wash p-4">
              <dt class="text-sm text-ink-2">{{ kpi.label }}</dt>
              <dd class="mt-1 text-2xl font-bold tabular-nums text-ink">{{ kpi.value }}</dd>
              <dd class="mt-1 text-sm text-ink-3">{{ kpi.hint }}</dd>
            </div>
          </dl>

          <div class="col-span-12 grid items-center gap-8 md:grid-cols-[minmax(0,280px)_minmax(0,1fr)] lg:col-span-9">
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

      <!-- Variation des prix par sous-type (stock, bitcoin, gold, ETF…), périodes en jours au choix -->
      <ChartGroup class="mt-10" :charts="SNAPSHOT_CHARTS" />

      <!-- Tes dettes (mode Brut) : par instrument, en positif -->
      <section
        v-if="model.debts.length"
        aria-labelledby="titre-dettes"
        class="mt-10 rounded-xl border border-line bg-paper p-4 shadow-soft sm:p-6"
      >
        <h2 id="titre-dettes" class="text-h3 text-ink">{{ t('snapshotPage.yourDebts') }}</h2>
        <p class="mt-1 tabular-nums text-ink-2">
          {{ t('snapshotPage.debtsTotal', { amount: formatAmount(Math.abs(model.liabilities)) }) }}
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
                <span class="font-semibold text-ink">{{ formatAmount(type.value) }}</span> ·
                {{ t('snapshotPage.ofWealth', { share: percent(type.share) }) }}
              </p>
              <!-- Mode net : le détail ci-dessous reste celui des actifs du type -->
              <p v-if="type.debts > 0" class="mt-1 text-sm tabular-nums text-ink-3">
                {{ t('snapshotPage.typeDebts', { amount: formatAmount(type.debts) }) }}
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
    </PageState>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { computed } from 'vue'
import PageState from '../components/PageState.vue'
import BaseChart from '../components/charts/BaseChart.vue'
import ShareBars from '../components/charts/ShareBars.vue'
import { usePageModel } from '../composables/usePageModel.js'
import ConversionNote from '../components/ConversionNote.vue'
import ChartGroup from '../components/charts/ChartGroup.vue'
import { SNAPSHOT_CHARTS } from '../lib/charts/index.js'
import { collectDropped } from '../lib/aggregate.js'
import { amountMode, amountNote, droppedNote } from '../lib/amounts.js'
import { NEGATIVE } from '../lib/palette.js'
import { donutOption } from '../lib/charts/assetDonut.js'
import { formatAmount, formatDateLong, percent } from '../lib/format.js'
import { buildSnapshot, signedPercent2 } from '../lib/snapshot.js'

const { t } = useI18n()

// Dettes : la couleur des baisses du site
const DEBT_COLOR = NEGATIVE

// history est facultative (point de départ des variations de l'année et du mois) : la page ne l'attend pas
const { status, model, error, missingTable, tables, reload } = usePageModel({
  required: ['portfolio'],
  optional: ['history'],
  build: ({ portfolio, history }) => {
    const [result, dropped] = collectDropped(() => buildSnapshot(portfolio, history, undefined, amountMode.value))
    return { ...result, dropped }
  },
})
const { portfolio, history } = tables

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
        total: formatAmount(model.value.total),
        biggest: model.value.legend[0].name,
        share: model.value.legend[0].share,
      })
    : '',
)

// Trois repères : variation depuis le début de l'année, du mois, et sur 24 h, jusqu'aux positions de portfolio
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
    {
      label: t('snapshotPage.last24h'),
      value: m.changes.day ? signedPercent2(m.changes.day.fraction) : '–',
      hint: m.changes.day ? since(m.changes.day) : t('snapshotPage.noPreviousDay'),
    },
  ]
})
</script>
