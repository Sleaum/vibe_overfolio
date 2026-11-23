<!--
  Correspondance des onglets (page GoogleSheet, sous « Onglets à synchroniser »).
  Une ligne par onglet attendu par le site (portfolio, _history, inout, budget, stock) :
  1. l'onglet de ta feuille qui le remplit, choisi parmi les onglets à synchroniser (défaut : celui qui porte le même nom) ;
  2. le nom utilisé par le site (les graphiques lisent la table de ce nom) ;
  3. ce que l'onglet doit contenir.
  À la synchronisation, l'onglet choisi est enregistré sous le nom de la colonne 2 (backend/googlesheet/config.py,
  table_names). Chaque choix est enregistré aussitôt (PUT /api/sheet-config/tab-map/).
  Prop `config` : paramètres reçus du serveur ({ tab_map, site_tabs, values.sync_tabs }). Événement `saved`.
-->
<template>
  <section class="rounded-xl border border-line bg-paper p-5 shadow-soft" aria-labelledby="tab-map-title">
    <h2 id="tab-map-title" class="text-sm font-medium text-ink">{{ t('tabMap.title') }}</h2>
    <p class="mt-1 max-w-3xl text-sm text-ink-3">{{ t('tabMap.lead') }}</p>

    <div class="mt-4 overflow-x-auto">
      <table class="w-full min-w-[40rem] text-left text-sm">
        <thead>
          <tr class="border-b border-line text-ink-2">
            <th scope="col" class="py-2 pr-4 font-medium">{{ t('tabMap.docTab') }}</th>
            <th scope="col" class="whitespace-nowrap py-2 pr-4 font-medium">{{ t('tabMap.siteName') }}</th>
            <th scope="col" class="py-2 font-medium">{{ t('tabMap.content') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.site" class="border-b border-line last:border-0 align-top">
            <td class="py-3 pr-4">
              <div class="relative w-56">
                <select
                  :id="`tab-map-${row.site}`"
                  :value="row.value"
                  :disabled="saving"
                  :aria-label="t('tabMap.selectLabel', { name: row.site })"
                  :data-testid="`tab-map-${row.site}`"
                  class="h-10 w-full appearance-none rounded-lg border border-line-strong bg-paper pl-3 pr-9 text-sm text-ink"
                  @change="choose(row.site, $event.target.value)"
                >
                  <option value="">{{ row.defaultLabel }}</option>
                  <option v-for="option in row.options" :key="option.value" :value="option.value">{{ option.label }}</option>
                </select>
                <svg
                  viewBox="0 0 20 20"
                  class="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-2"
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
            </td>
            <td class="py-3 pr-4">
              <code class="rounded bg-wash px-1.5 py-0.5 text-ink">{{ row.site }}</code>
            </td>
            <td class="py-3 text-ink-2">{{ t(`tabMap.explain.${EXPLAIN_KEYS[row.site]}`) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <p v-if="error" class="mt-3 text-sm text-danger" role="alert">{{ error }}</p>
    <p v-else-if="notice" class="mt-3 text-sm font-medium text-success" role="status">{{ notice }}</p>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { saveTabMap } from '../lib/api.js'

const props = defineProps({
  config: { type: Object, required: true },
})
const emit = defineEmits(['saved'])

const { t } = useI18n()

// Clé de l'explication de chaque onglet du site (rubrique tabMap.explain des fichiers de langue)
const EXPLAIN_KEYS = { portfolio: 'portfolio', _history: 'history', inout: 'inout', budget: 'budget', stock: 'stock' }

const saving = ref(false)
const error = ref('')
const notice = ref('')

const siteTabs = computed(() => props.config.site_tabs ?? Object.keys(EXPLAIN_KEYS))
const mapping = computed(() => props.config.tab_map ?? {})
const syncTabs = computed(() =>
  (props.config.values?.sync_tabs ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean),
)

const rows = computed(() =>
  siteTabs.value.map((site) => {
    const value = mapping.value[site] ?? ''
    // Onglets déjà pris par une autre ligne, et onglets qui portent le nom d'un autre onglet du site : pas proposés
    const taken = new Set([
      ...Object.entries(mapping.value)
        .filter(([other]) => other !== site)
        .map(([, tab]) => tab),
      ...siteTabs.value.filter((other) => other !== site),
    ])
    const options = syncTabs.value
      .filter((tab) => tab !== site && !taken.has(tab))
      .map((tab) => ({ value: tab, label: tab }))
    // Onglet relié mais retiré entre-temps des onglets à synchroniser : il reste affiché, signalé
    if (value && !syncTabs.value.includes(value)) {
      options.push({ value, label: t('tabMap.notSynced', { name: value }) })
    }
    const defaultLabel = syncTabs.value.includes(site) ? t('tabMap.sameName', { name: site }) : t('tabMap.none')
    return { site, value, options, defaultLabel }
  }),
)

async function choose(site, value) {
  saving.value = true
  error.value = ''
  notice.value = ''
  try {
    const next = { ...mapping.value }
    if (value) next[site] = value
    else delete next[site]
    const config = await saveTabMap(next)
    notice.value = t('tabMap.saved')
    emit('saved', config)
  } catch (failure) {
    error.value = failure.message
  } finally {
    saving.value = false
  }
}
</script>
