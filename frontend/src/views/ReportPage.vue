<!--
  Page « Rapport PDF » (/rapport, bouton PDF de l'en-tête) : tout le site en un seul PDF.
  - Affiche à la suite les pages Flow, Snapshot, Envelopes, Strategy, Volatility, Budget et Simulation, chacune sur une
    nouvelle page du PDF, avec les réglages en cours : montants brut ou net, mode clair ou sombre, langue.
  - Attend que tout soit chargé (plus aucun élément « chargement » : role="status"), puis ouvre la fenêtre d'impression,
    où l'on choisit « Enregistrer au format PDF ». Rien n'est envoyé au serveur.
  - Largeur fixe (A4 paysage) : les graphiques sont dessinés à la taille de la page. Les graphiques n'y sont pas animés
    (provide 'report', lu par BaseChart.vue).
  - Les filtres propres à une page (année de Flow, enveloppe de Strategy…) restent ceux par défaut.
-->
<template>
  <div class="mx-auto w-[1040px] max-w-none px-0 py-10 print:w-auto print:px-[10mm] print:py-[8mm]">
    <!-- Barre d'outils : à l'écran seulement -->
    <div class="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-wash p-4 print:hidden">
      <p class="text-ink-2" role="status" aria-live="polite">
        {{ ready ? (timedOut ? t('report.timeout') : t('report.ready')) : t('report.preparing', { done: loaded, total: SECTIONS.length }) }}
      </p>
      <div class="flex gap-2">
        <AppButton variant="secondary" size="sm" @click="router.back()">{{ t('report.back') }}</AppButton>
        <AppButton size="sm" :disabled="!ready" @click="print">{{ t('report.print') }}</AppButton>
      </div>
    </div>

    <div ref="root">
      <!-- Couverture -->
      <header class="border-b border-line pb-6">
        <h1 class="text-h2 text-ink">{{ t('report.title', { date: formatDateLong(today) }) }}</h1>
        <p class="mt-2 text-ink-2">{{ settingsLine }}</p>
        <p class="mt-1 text-sm text-ink-3">{{ t('report.hint') }}</p>
      </header>

      <section
        v-for="(section, index) in SECTIONS"
        :key="section.key"
        class="mt-10"
        :class="index > 0 ? 'break-before-page print:mt-0' : ''"
      >
        <component :is="section.component" v-bind="section.props" />
      </section>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { computed, defineAsyncComponent, h, onBeforeUnmount, onMounted, provide, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppButton from '../components/ui/AppButton.vue'
import ChartView from '../components/charts/ChartView.vue'
import { LANGUAGES } from '../i18n/index.js'
import { amountMode } from '../lib/amounts.js'
import budgetFlow from '../lib/charts/budgetFlow.js'
import { formatDateLong } from '../lib/format.js'
import { useTheme } from '../composables/useTheme.js'

const { t, locale } = useI18n()
const router = useRouter()
const { isDark } = useTheme()
provide('report', true)

// Pages du rapport, dans l'ordre du menu de Charts, puis Simulation
const SECTIONS = [
  { key: 'flow', component: defineAsyncComponent(() => import('./PortfolioFlowPage.vue')) },
  { key: 'snapshot', component: defineAsyncComponent(() => import('./SnapshotPage.vue')) },
  { key: 'envelopes', component: defineAsyncComponent(() => import('./EnvelopesPage.vue')) },
  { key: 'strategy', component: defineAsyncComponent(() => import('./StrategyPage.vue')) },
  { key: 'volatility', component: defineAsyncComponent(() => import('./VolatilityPage.vue')) },
  { key: 'budget', component: { render: () => h(ChartView, { spec: budgetFlow }) } },
  { key: 'simulation', component: defineAsyncComponent(() => import('./SimulationPage.vue')) },
]

const today = new Date().toISOString().slice(0, 10)
const settingsLine = computed(() =>
  t('report.settings', {
    amounts: t(`report.amounts.${amountMode.value}`),
    theme: t(`report.theme.${isDark.value ? 'dark' : 'light'}`),
    language: LANGUAGES.find((language) => language.code === locale.value)?.name ?? locale.value,
  }),
)

/* ---------- Attente du chargement, puis impression ---------- */

const root = ref(null)
const ready = ref(false)
const timedOut = ref(false)
const loaded = ref(0)
const TIMEOUT = 30_000 // au-delà, on imprime quand même et la barre le signale
const STABLE = 1_000 // tout doit rester chargé pendant 1 s (les graphiques se dessinent après les données)
let timer = 0
let printed = false

function check(startedAt, calmSince) {
  const sections = [...(root.value?.querySelectorAll(':scope > section') ?? [])]
  const pending = sections.filter((section) => section.querySelector('[role="status"]') || !section.childElementCount)
  loaded.value = sections.length - pending.length
  const now = Date.now()
  const calm = pending.length ? 0 : calmSince || now
  if ((calm && now - calm >= STABLE) || now - startedAt > TIMEOUT) {
    timedOut.value = pending.length > 0
    ready.value = true
    if (!printed) {
      printed = true
      print()
    }
    return
  }
  timer = setTimeout(() => check(startedAt, calm), 300)
}

// Le titre de l'onglet devient le nom proposé pour le fichier PDF
function print() {
  const title = document.title
  document.title = `Overfolio ${today}`
  window.print()
  document.title = title
}

onMounted(() => check(Date.now(), 0))
onBeforeUnmount(() => clearTimeout(timer))
</script>
