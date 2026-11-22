<!--
  Onglets à synchroniser (section Onglet de la page GoogleSheet, juste au-dessus de « Tout actualiser »).
  - Champ « Onglets à synchroniser » : noms séparés par des virgules, bouton Enregistrer.
  - Juste en dessous, « Proposer les onglets du document » : lit les onglets du document enregistré
    (GET /api/sheet-config/tabs/). Cocher ou décocher un onglet enregistre aussitôt la liste.
  - Tout passe par PUT /api/sheet-config/tabs/, qui n'enregistre que la liste : le formulaire de connexion n'est pas touché.
  - Onglets du document lus : la liste ne garde que ceux qui existent dans le document (ceux d'un ancien document
    sont effacés) ; s'il n'en reste aucun, elle prend tous les onglets du document. Enregistrée aussitôt.
  - Prop `tabs` : liste enregistrée. Prop `autoload` : lit les onglets du document dès l'affichage (document changé).
  - Événement `saved` avec la configuration renvoyée par le serveur.
-->
<template>
  <section class="rounded-xl border border-line bg-paper p-5 shadow-soft" aria-labelledby="sync-tabs-label">
    <form @submit.prevent="saveText">
      <label id="sync-tabs-label" for="sync-tabs" class="block text-sm font-medium text-ink">{{ t('syncTabs.label') }}</label>
      <div class="mt-1.5 flex flex-col gap-3 sm:flex-row">
        <input
          id="sync-tabs"
          v-model="text"
          type="text"
          autocomplete="off"
          spellcheck="false"
          placeholder="portfolio, inout, stock, budget, _history"
          :aria-invalid="!!error"
          aria-describedby="sync-tabs-help"
          class="h-11 w-full rounded-lg border bg-paper px-3.5 text-[0.9375rem] text-ink placeholder:text-ink-3 sm:max-w-xl"
          :class="error ? 'border-danger' : 'border-line-strong'"
        />
        <AppButton type="submit" variant="secondary" :disabled="saving || !changed" :aria-busy="saving">
          {{ saving ? t('syncTabs.saving') : t('syncTabs.save') }}
        </AppButton>
      </div>
      <p id="sync-tabs-help" class="mt-1.5 text-sm" :class="error ? 'text-danger' : 'text-ink-3'" :role="error ? 'alert' : undefined">
        {{ error || t('syncTabs.help') }}
      </p>
    </form>

    <!-- Onglets du document, collés au champ : cochés = synchronisés -->
    <div class="mt-4">
      <AppButton variant="outline" size="sm" :disabled="docLoading" @click="loadDocTabs">
        {{ docLoading ? t('syncTabs.loading') : t('syncTabs.suggest') }}
      </AppButton>
      <p v-if="docError" class="mt-2 text-sm text-danger" role="alert">{{ docError }}</p>
      <fieldset v-if="docTabs.length" class="mt-3" :disabled="saving">
        <legend class="text-sm font-medium text-ink">{{ t('syncTabs.legend') }}</legend>
        <div class="mt-2 flex flex-wrap gap-x-6 gap-y-2">
          <label v-for="tab in docTabs" :key="tab" class="flex cursor-pointer items-center gap-2 text-sm text-ink">
            <input type="checkbox" class="h-4 w-4 accent-accent" :checked="tabs.includes(tab)" @change="toggle(tab, $event)" />
            {{ tab }}
          </label>
        </div>
        <p class="mt-2 text-sm text-ink-3">{{ t('syncTabs.instant') }}</p>
      </fieldset>
    </div>

    <p v-if="notice" class="mt-3 text-sm font-medium text-success" role="status">{{ notice }}</p>
  </section>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AppButton from './ui/AppButton.vue'
import { getSheetTabs, saveSyncTabs } from '../lib/api.js'

const props = defineProps({
  tabs: { type: Array, required: true }, // liste enregistrée
  autoload: { type: Boolean, default: false },
})
const emit = defineEmits(['saved'])

const { t } = useI18n()

const parse = (raw) =>
  raw
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)

/* ---------- Champ « Onglets à synchroniser » ---------- */

const text = ref(props.tabs.join(', '))
const changed = computed(() => parse(text.value).join(',') !== props.tabs.join(','))
// Liste enregistrée ailleurs (case cochée, formulaire rechargé) : le champ suit, sauf saisie en cours
watch(
  () => props.tabs.join(','),
  (_, before) => {
    if (parse(text.value).join(',') === before) text.value = props.tabs.join(', ')
  },
)

const saving = ref(false)
const error = ref('')
const notice = ref('')
let noticeTimer = 0
onBeforeUnmount(() => clearTimeout(noticeTimer))

async function save(list, message = t('syncTabs.saved')) {
  saving.value = true
  error.value = ''
  notice.value = ''
  try {
    const config = await saveSyncTabs(list.join(', '))
    text.value = list.join(', ')
    emit('saved', config)
    notice.value = message
    clearTimeout(noticeTimer)
    noticeTimer = setTimeout(() => (notice.value = ''), 4000)
    return true
  } catch (err) {
    error.value = err.fields?.sync_tabs || err.message
    return false
  } finally {
    saving.value = false
  }
}

function saveText() {
  save(parse(text.value))
}

/* ---------- Onglets du document ---------- */

const docTabs = ref([])
const docLoading = ref(false)
const docError = ref('')

async function loadDocTabs() {
  docLoading.value = true
  docError.value = ''
  try {
    docTabs.value = (await getSheetTabs()).tabs ?? []
  } catch (err) {
    docTabs.value = []
    docError.value = err.message
    return
  } finally {
    docLoading.value = false
  }
  await followDocument()
}

// La liste suit le document : onglets absents effacés, tous les onglets du document si aucun ne reste
async function followDocument() {
  if (!docTabs.value.length) return
  const kept = props.tabs.filter((tab) => docTabs.value.includes(tab))
  const next = kept.length ? kept : [...docTabs.value]
  if (next.join(',') === props.tabs.join(',')) return
  const removed = props.tabs.filter((tab) => !next.includes(tab))
  await save(next, removed.length ? t('syncTabs.removed', { tabs: removed.join(', ') }, removed.length) : t('syncTabs.saved'))
}

onMounted(() => {
  if (props.autoload) loadDocTabs()
})

// Cocher ou décocher : la liste enregistrée change aussitôt (le dernier onglet ne peut pas être retiré : erreur du serveur)
async function toggle(name, event) {
  const current = props.tabs
  const ok = await save(current.includes(name) ? current.filter((tab) => tab !== name) : [...current, name])
  if (!ok) event.target.checked = current.includes(name) // refus : la case reprend son état
}
</script>
