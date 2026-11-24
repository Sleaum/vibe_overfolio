<!--
  Page « GoogleSheet » (/sheet, ancienne adresse /source conservée) : les cinq onglets de la feuille, tels que la base les contient.
  - Menu déroulant des onglets (l'onglet choisi est aussi dans l'adresse : /sheet?onglet=budget).
  - Bouton Tout actualiser : relit tous les onglets de la liste dans Google Sheets (POST), puis recharge la liste et le tableau.
  - Connexion à Google Sheets : formulaire des paramètres d'accès (préremplis avec le .env), voir SheetSettings.vue.
  - Onglets à synchroniser : champ et onglets du document à cocher, juste au-dessus de Tout actualiser, voir SyncTabs.vue.
  - Tableau : en-tête fixe, nombres alignés à droite, recherche, pagination par 50 lignes, défilement horizontal sur mobile.
-->
<template>
  <div class="page-container py-12 sm:py-16">
    <header class="max-w-3xl">
      <h1 class="text-h2 text-ink">GoogleSheet</h1>
      <p class="mt-3 text-lead text-ink-2">{{ t('sheetPage.lead') }}</p>
    </header>

    <SheetSettings @loaded="applyConfig" @saved="onConfigSaved" />

    <!-- Liste des onglets : chargement -->
    <p v-if="state === 'loading-list'" role="status" class="mt-10 text-ink-2">{{ t('sheetPage.loadingTabs') }}</p>

    <!-- Liste des onglets : erreur -->
    <div
      v-else-if="state === 'list-error'"
      role="alert"
      class="mt-10 max-w-2xl rounded-lg border border-danger-line bg-danger-wash p-5"
    >
      <p class="font-semibold text-danger">{{ t('sheetPage.listError') }}</p>
      <p class="mt-1 text-ink">{{ listError }}</p>
      <AppButton variant="secondary" size="sm" class="mt-4" @click="start">{{ t('chartUi.retry') }}</AppButton>
    </div>

    <template v-else>
      <!-- Onglets à synchroniser (champ + onglets du document à cocher), juste au-dessus de Tout actualiser -->
      <SyncTabs :key="docKey" class="mt-10" :tabs="knownTabs" :autoload="docChanged" @saved="onConfigSaved" />
      <!-- Barre d'outils : onglet, Tout actualiser, recherche -->
      <div class="mt-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div>
            <label for="onglet" class="block text-sm font-medium text-ink">{{ t('sheetPage.tab') }}</label>
            <div class="relative mt-1.5">
              <select
                id="onglet"
                v-model="selected"
                class="h-11 w-full appearance-none rounded-lg border border-line-strong bg-paper pl-3.5 pr-10 text-[0.9375rem] text-ink sm:w-72"
              >
                <option v-for="option in options" :key="option.name" :value="option.name">{{ option.label }}</option>
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

          <AppButton
            class="min-w-[10rem]"
            :disabled="syncing"
            :aria-busy="syncing"
            :title="t('sheetPage.refreshTitle')"
            @click="refresh"
          >
            {{ syncing ? t('sheetPage.refreshing') : t('sheetPage.refreshAll') }}
          </AppButton>
        </div>

        <div v-if="state === 'ready' && total > 0" class="relative w-full lg:w-80">
          <label for="recherche" class="sr-only">{{ t('sheetPage.search') }}</label>
          <svg
            viewBox="0 0 20 20"
            class="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-3"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            aria-hidden="true"
          >
            <circle cx="9" cy="9" r="5.5" />
            <path d="M13.5 13.5L17 17" />
          </svg>
          <input
            id="recherche"
            v-model="query"
            type="search"
            autocomplete="off"
            :placeholder="t('sheetPage.search')"
            class="h-11 w-full rounded-lg border border-line-strong bg-paper pl-11 pr-3 text-[0.9375rem] text-ink placeholder:text-ink-3"
          />
        </div>
      </div>

      <!-- Date de synchronisation, nombre de lignes, confirmation -->
      <div class="mt-6 flex min-h-[1.5rem] flex-wrap gap-x-6 gap-y-1 text-sm text-ink-2" aria-live="polite">
        <template v-if="state === 'ready'">
          <span class="font-medium text-ink">{{ rowsLabel }}</span>
          <span v-if="syncedLabel">{{ t('sheetPage.syncedOn', { date: syncedLabel }) }}</span>
          <span v-if="data?.computed_columns?.length" data-testid="sheet-computed">
            {{ t('sheetPage.computedColumns', { columns: data.computed_columns.join(', ') }) }}
          </span>
          <ConversionNote :table="data" testid="sheet-converted" />
        </template>
        <span v-if="notice" class="font-medium text-success">{{ notice }}</span>
      </div>

      <!-- Échec de l'actualisation : le tableau reste affiché en dessous -->
      <div v-if="syncError" role="alert" class="mt-4 rounded-lg border border-danger-line bg-danger-wash p-4">
        <p class="font-semibold text-danger">{{ t('sheetPage.syncIncomplete') }}</p>
        <p class="mt-1 text-ink">{{ syncError }}</p>
      </div>

      <div class="mt-4">
        <!-- Chargement de l'onglet -->
        <div
          v-if="state === 'loading'"
          role="status"
          class="flex h-64 items-center justify-center rounded-xl bg-wash text-ink-2 motion-safe:animate-pulse"
        >
          {{ t('sheetPage.loadingTab') }}
        </div>

        <!-- Onglet jamais synchronisé -->
        <div
          v-else-if="state === 'unsynced'"
          class="flex flex-col items-center rounded-xl border border-dashed border-line-strong bg-wash px-6 py-14 text-center"
        >
          <p class="text-h3 text-ink">{{ t('sheetPage.unsyncedTitle') }}</p>
          <p class="mt-2 max-w-md text-ink-2">
            {{ t('sheetPage.unsyncedText') }}
          </p>
        </div>

        <!-- Erreur de chargement de l'onglet -->
        <div
          v-else-if="state === 'error'"
          role="alert"
          class="rounded-lg border border-danger-line bg-danger-wash p-5"
        >
          <p class="font-semibold text-danger">{{ t('sheetPage.tabError', { tab: selected }) }}</p>
          <p class="mt-1 text-ink">{{ error.message }}</p>
          <AppButton variant="secondary" size="sm" class="mt-4" @click="reload">{{ t('chartUi.retry') }}</AppButton>
        </div>

        <!-- Onglet chargé -->
        <template v-else>
          <div
            v-if="total === 0"
            class="flex flex-col items-center rounded-xl border border-dashed border-line-strong bg-wash px-6 py-14 text-center"
          >
            <p class="text-h3 text-ink">{{ t('sheetPage.emptyTitle') }}</p>
            <p class="mt-2 max-w-md text-ink-2">
              {{ t('sheetPage.emptyText') }}
            </p>
          </div>

          <div
            v-else-if="!filtered.length"
            class="flex flex-col items-center rounded-xl border border-dashed border-line-strong bg-wash px-6 py-14 text-center"
          >
            <p class="text-h3 text-ink">{{ t('sheetPage.noMatchTitle') }}</p>
            <p class="mt-2 max-w-md text-ink-2">{{ t('sheetPage.noMatchText', { query: query.trim() }) }}</p>
            <AppButton variant="secondary" size="sm" class="mt-5" @click="query = ''">{{ t('sheetPage.clearSearch') }}</AppButton>
          </div>

          <template v-else>
            <div
              ref="scroller"
              class="max-h-[70vh] overflow-auto rounded-xl border border-line bg-paper shadow-soft transition-opacity"
              :class="loading ? 'opacity-60' : ''"
              role="region"
              tabindex="0"
              :aria-label="t('sheetPage.tableOf', { tab: selected })"
              :aria-busy="loading"
            >
              <table class="min-w-full border-separate border-spacing-0 text-sm">
                <caption class="sr-only">
                  {{ t('sheetPage.caption', { tab: selected, rows: rowsLabel }) }}
                </caption>
                <thead>
                  <tr>
                    <th
                      v-for="column in columns"
                      :key="column"
                      scope="col"
                      class="sticky top-0 z-10 whitespace-nowrap border-b border-line bg-wash px-4 py-3 font-semibold text-ink"
                      :class="numericColumns.has(column) ? 'text-right' : 'text-left'"
                    >
                      {{ column }}
                    </th>
                  </tr>
                </thead>
                <tbody class="[&>tr:last-child>td]:border-b-0">
                  <tr v-for="(row, index) in visibleRows" :key="firstRow + index" class="hover:bg-wash">
                    <td
                      v-for="column in columns"
                      :key="column"
                      class="whitespace-nowrap border-b border-line px-4 py-2.5 text-ink"
                      :class="numericColumns.has(column) ? 'text-right tabular-nums' : 'text-left'"
                    >
                      {{ formatCell(row[column], column) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <nav
              v-if="pageCount > 1"
              :aria-label="t('sheetPage.pagination')"
              class="mt-6 flex flex-wrap items-center justify-between gap-4"
            >
              <p class="text-sm text-ink-2">
                {{ t('sheetPage.rowsRange', { from: formatNumber(firstRow), to: formatNumber(lastRow), total: formatNumber(filtered.length) }) }}
              </p>
              <div class="flex items-center gap-3">
                <AppButton variant="secondary" size="sm" :disabled="page <= 1" @click="goTo(page - 1)">
                  {{ t('sheetPage.previous') }}
                </AppButton>
                <span class="text-sm text-ink-2">{{ t('sheetPage.pageOf', { page, count: pageCount }) }}</span>
                <AppButton variant="secondary" size="sm" :disabled="page >= pageCount" @click="goTo(page + 1)">
                  {{ t('sheetPage.next') }}
                </AppButton>
              </div>
            </nav>
          </template>
        </template>
      </div>
    </template>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppButton from '../components/ui/AppButton.vue'
import SheetSettings from '../components/SheetSettings.vue'
import SyncTabs from '../components/SyncTabs.vue'
import { useTable } from '../composables/useTable.js'
import ConversionNote from '../components/ConversionNote.vue'
import { apiMessage, listTables, syncAll } from '../lib/api.js'
import { loadPortfolioDate } from '../lib/portfolioDate.js'
import { formatCell, formatDateTime, formatNumber } from '../lib/format.js'

const { t } = useI18n()
// « 1 234 lignes » dans la langue active
const rowsText = (n) => t('sheetPage.rows', { count: formatNumber(n) }, n)

const PAGE_SIZE = 50

// Onglets à synchroniser (section Onglet, SyncTabs.vue). Un onglet qui n'est pas encore en base reste choisissable :
// on peut le synchroniser. Liste par défaut en attendant les paramètres.
const knownTabs = ref(['portfolio', 'inout', 'stock', 'budget', 'history'])
// Document en vigueur : quand il change, la liste « Onglets du document » déjà lue est oubliée
const docKey = ref('')
// Vrai quand un autre document vient d'être enregistré : ses onglets sont lus tout de suite (la liste les suit)
const docChanged = ref(false)

const route = useRoute()
const router = useRouter()

const tables = ref([]) // [{ name, row_count, synced_at }] : les onglets déjà en base
const loadingList = ref(true)
const listError = ref('')

const selected = ref('')
const syncing = ref(false)
const syncError = ref('')
const notice = ref('')
const query = ref('')
const page = ref(1)
const scroller = ref(null)

// Table choisie : se recharge toute seule quand `selected` change
const { data, loading, error, reload } = useTable(selected, { raw: true })

/* ---------- Liste des onglets ---------- */

const options = computed(() => {
  const inBase = new Map(tables.value.map((table) => [table.name, table]))
  const extras = tables.value.map((table) => table.name).filter((name) => !knownTabs.value.includes(name))
  return [...knownTabs.value, ...extras].map((name) => {
    const info = inBase.get(name)
    return {
      name,
      label: info ? t('sheetPage.optionRows', { name, rows: rowsText(info.row_count) }) : t('sheetPage.notSynced', { name }),
    }
  })
})

// `quiet` : rafraîchissement après une synchronisation, une panne de la liste ne doit pas masquer le tableau
async function loadList({ quiet = false } = {}) {
  if (!quiet) {
    loadingList.value = true
    listError.value = ''
  }
  try {
    tables.value = await listTables()
  } catch (err) {
    if (!quiet) listError.value = err.message
  } finally {
    if (!quiet) loadingList.value = false
  }
}

async function start() {
  await loadList()
  if (listError.value) return
  const names = options.value.map((option) => option.name)
  const wanted = typeof route.query.onglet === 'string' ? route.query.onglet : ''
  selected.value = names.includes(wanted) ? wanted : names[0]
}

onMounted(start)

/* ---------- Paramètres de connexion ---------- */

function applyConfig(config) {
  const tabs = (config?.values?.sync_tabs || '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
  if (tabs.length) knownTabs.value = tabs
  if (config?.values) {
    const key = [config.mode, config.values.sheet_id, config.values.doc_name].join('|')
    if (docKey.value && key !== docKey.value) docChanged.value = true
    docKey.value = key
  }
}

function onConfigSaved(config) {
  applyConfig(config)
  syncError.value = ''
  loadList({ quiet: true })
}

/* ---------- Choix de l'onglet, adresse de la page ---------- */

watch(selected, (name) => {
  if (!name) return
  query.value = ''
  page.value = 1
  syncError.value = ''
  notice.value = ''
  if (route.query.onglet !== name) router.replace({ query: { ...route.query, onglet: name } })
})

// Lien /sheet?onglet=… ouvert pendant que la page est déjà affichée
watch(
  () => route.query.onglet,
  (name) => {
    if (typeof name === 'string' && name !== selected.value && options.value.some((o) => o.name === name)) {
      selected.value = name
    }
  },
)

/* ---------- Tout actualiser ---------- */

let noticeTimer = 0
onBeforeUnmount(() => clearTimeout(noticeTimer))

function showNotice(text) {
  notice.value = text
  clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => {
    notice.value = ''
  }, 6000)
}

async function refresh() {
  if (syncing.value) return
  syncing.value = true
  syncError.value = ''
  notice.value = ''
  try {
    const result = await syncAll()
    // Date des positions de l'en-tête (lib/portfolioDate.js) : portfolio vient peut-être de changer
    await Promise.all([loadList({ quiet: true }), selected.value ? reload() : null, loadPortfolioDate()])
    const tabs = result.tabs ?? []
    const failed = tabs.filter((tab) => !tab.ok)
    const saved = tabs.length - failed.length
    const removed = result.removed ?? []
    showNotice(
      [
        t('sheetPage.savedNotice', { count: saved }, saved),
        removed.length ? t('sheetPage.removedNotice', { count: removed.length, names: removed.join(', ') }, removed.length) : '',
      ]
        .filter(Boolean)
        .join(' '),
    )
    if (result.fx?.error) syncError.value = apiMessage(result.fx.error, {}, result.fx.error)
    if (failed.length) {
      const details = failed
        .map((tab) => t('sheetPage.tabFailure', { tab: tab.name, message: apiMessage(tab.code, tab.params, tab.message) || t('sheetPage.error') }))
        .join(' ; ')
      syncError.value = t('sheetPage.failedNotice', { count: failed.length, details }, failed.length)
    }
  } catch (err) {
    syncError.value = err.message
  } finally {
    syncing.value = false
  }
}

/* ---------- Tableau ---------- */

const columns = computed(() => data.value?.columns ?? [])
const rows = computed(() => data.value?.rows ?? [])
const total = computed(() => rows.value.length)

// Une colonne est numérique quand ses valeurs sont en majorité des nombres : en-tête et cellules s'alignent à droite
const numericColumns = computed(() => {
  const numeric = new Set()
  for (const column of columns.value) {
    let numbers = 0
    let others = 0
    for (const row of rows.value) {
      const value = row[column]
      if (value === null || value === undefined || value === '') continue
      if (typeof value === 'number') numbers += 1
      else others += 1
    }
    if (numbers > others) numeric.add(column)
  }
  return numeric
})

// Recherche sans tenir compte des majuscules, des accents ni des espaces insécables
const fold = (text) =>
  String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[  ]/g, ' ')

// Construit à la première recherche seulement, puis réutilisé à chaque frappe
const searchIndex = computed(() =>
  rows.value.map((row) =>
    fold(columns.value.map((column) => `${row[column] ?? ''} ${formatCell(row[column], column)}`).join(' | ')),
  ),
)

const filtered = computed(() => {
  const needle = fold(query.value.trim())
  if (!needle) return rows.value
  return rows.value.filter((_row, index) => searchIndex.value[index].includes(needle))
})

const pageCount = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE)))
const firstRow = computed(() => (page.value - 1) * PAGE_SIZE + 1)
const lastRow = computed(() => Math.min(page.value * PAGE_SIZE, filtered.value.length))
const visibleRows = computed(() => filtered.value.slice(firstRow.value - 1, lastRow.value))

watch(query, () => {
  page.value = 1
})
watch(pageCount, (count) => {
  if (page.value > count) page.value = count
})

async function goTo(next) {
  page.value = Math.min(Math.max(1, next), pageCount.value)
  await nextTick()
  scroller.value?.scrollTo({ top: 0 })
}

/* ---------- Textes ---------- */

const rowsLabel = computed(() => {
  const all = rowsText(total.value)
  return query.value.trim() ? t('sheetPage.filtered', { shown: formatNumber(filtered.value.length), all }) : all
})

const syncedLabel = computed(() => (data.value?.synced_at ? formatDateTime(data.value.synced_at) : ''))

const state = computed(() => {
  if (loadingList.value) return 'loading-list'
  if (listError.value) return 'list-error'
  if (!selected.value) return 'loading-list'
  if (data.value) return 'ready'
  if (loading.value) return 'loading'
  if (error.value?.status === 404) return 'unsynced'
  if (error.value) return 'error'
  return 'loading'
})
</script>
