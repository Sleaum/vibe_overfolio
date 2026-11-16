<!--
  Paramètres d'accès au Google Sheet (page GoogleSheet).
  - Les champs sont préremplis avec les valeurs en vigueur : celles enregistrées ici, sinon celles du .env.
  - La clé privée n'est jamais renvoyée par le serveur : laissée vide, la clé en vigueur est conservée.
  - « Importer le fichier JSON » remplit les champs du compte de service depuis le fichier téléchargé dans Google Cloud.
  - Événements : `loaded` et `saved` avec la configuration ({ source, values, private_key_set, … }).
-->
<template>
  <section class="mt-10 rounded-xl border border-line bg-white shadow-soft" aria-labelledby="sheet-settings-title">
    <div class="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 id="sheet-settings-title" class="text-h3 text-ink">Connexion à Google Sheets</h2>
        <p class="mt-1 text-sm text-ink-2" aria-live="polite">
          <template v-if="loading">Chargement des paramètres…</template>
          <template v-else-if="loadError">Paramètres indisponibles</template>
          <template v-else-if="config?.source === 'page'">
            Valeurs enregistrées sur cette page<span v-if="updatedLabel"> le {{ updatedLabel }}</span>.
          </template>
          <template v-else>Valeurs par défaut, lues dans le fichier .env.</template>
          <span v-if="!loading && !loadError && config?.values.client_email">
            Document lu par {{ config.values.client_email }}.
          </span>
        </p>
      </div>
      <AppButton
        variant="secondary"
        size="sm"
        :aria-expanded="open"
        aria-controls="sheet-settings-form"
        @click="open = !open"
      >
        {{ open ? 'Masquer' : 'Modifier' }}
      </AppButton>
    </div>

    <div v-if="loadError" role="alert" class="mx-5 mb-5 rounded-lg border border-danger-line bg-danger-wash p-4">
      <p class="text-ink">{{ loadError }}</p>
      <AppButton variant="secondary" size="sm" class="mt-3" @click="load">Réessayer</AppButton>
    </div>

    <form
      v-show="open && config"
      id="sheet-settings-form"
      class="border-t border-line p-5"
      novalidate
      @submit.prevent="save"
    >
      <!-- Document -->
      <fieldset>
        <legend class="text-sm font-semibold uppercase tracking-wide text-ink-2">Document</legend>
        <div class="mt-4 grid gap-5 md:grid-cols-2">
          <div v-for="field in DOC_FIELDS" :key="field.name" :class="field.wide ? 'md:col-span-2' : ''">
            <label :for="`cfg-${field.name}`" class="block text-sm font-medium text-ink">{{ field.label }}</label>
            <input
              :id="`cfg-${field.name}`"
              v-model="form[field.name]"
              type="text"
              autocomplete="off"
              spellcheck="false"
              :placeholder="field.placeholder"
              :aria-invalid="!!errors[field.name]"
              :aria-describedby="`cfg-${field.name}-help`"
              :class="inputClass(field.name)"
            />
            <p :id="`cfg-${field.name}-help`" class="mt-1.5 text-sm" :class="errors[field.name] ? 'text-danger' : 'text-ink-3'">
              {{ errors[field.name] || field.help }}
            </p>
          </div>
        </div>
      </fieldset>

      <!-- Compte de service -->
      <fieldset class="mt-8">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <legend class="text-sm font-semibold uppercase tracking-wide text-ink-2">Compte de service Google</legend>
          <div>
            <input ref="fileInput" type="file" accept="application/json,.json" class="sr-only" tabindex="-1" @change="importJson" />
            <AppButton variant="outline" size="sm" @click="fileInput?.click()">Importer le fichier JSON</AppButton>
          </div>
        </div>
        <p class="mt-2 text-sm text-ink-3">
          Le fichier se télécharge dans Google Cloud : IAM → Comptes de service → Clés. Partage ensuite le Google Sheet,
          en Lecteur, avec l’adresse du compte de service.
        </p>
        <p v-if="importMessage" class="mt-2 text-sm" :class="importError ? 'text-danger' : 'text-success'" role="status">
          {{ importMessage }}
        </p>

        <div class="mt-4 grid gap-5 md:grid-cols-2">
          <div v-for="field in ACCOUNT_FIELDS" :key="field.name">
            <label :for="`cfg-${field.name}`" class="block text-sm font-medium text-ink">
              {{ field.label }}<span v-if="field.required" class="text-ink-3"> (obligatoire)</span>
            </label>
            <input
              :id="`cfg-${field.name}`"
              v-model="form[field.name]"
              :type="field.type || 'text'"
              autocomplete="off"
              spellcheck="false"
              :aria-invalid="!!errors[field.name]"
              :aria-describedby="errors[field.name] ? `cfg-${field.name}-err` : undefined"
              :class="inputClass(field.name)"
            />
            <p v-if="errors[field.name]" :id="`cfg-${field.name}-err`" class="mt-1.5 text-sm text-danger">
              {{ errors[field.name] }}
            </p>
          </div>

          <div class="md:col-span-2">
            <label for="cfg-private_key" class="block text-sm font-medium text-ink">
              Clé privée<span class="text-ink-3"> (obligatoire)</span>
            </label>
            <textarea
              id="cfg-private_key"
              v-model="form.private_key"
              rows="4"
              autocomplete="off"
              spellcheck="false"
              :placeholder="
                keySet
                  ? 'Une clé est déjà enregistrée. Laisse vide pour la conserver, ou colle une nouvelle clé.'
                  : '-----BEGIN PRIVATE KEY-----…'
              "
              :aria-invalid="!!errors.private_key"
              aria-describedby="cfg-private_key-help"
              :class="[inputClass('private_key'), 'h-auto py-2.5 font-mono text-sm']"
            />
            <p id="cfg-private_key-help" class="mt-1.5 text-sm" :class="errors.private_key ? 'text-danger' : 'text-ink-3'">
              {{
                errors.private_key ||
                (keySet
                  ? `Clé en place (${keySource}). Par sécurité, elle n’est jamais réaffichée.`
                  : 'Aucune clé n’est définie, ni ici ni dans le .env.')
              }}
            </p>
          </div>
        </div>

        <details class="mt-6 rounded-lg border border-line">
          <summary class="cursor-pointer select-none px-4 py-3 text-sm font-medium text-ink">
            Champs avancés (rarement à modifier)
          </summary>
          <div class="grid gap-5 border-t border-line p-4 md:grid-cols-2">
            <div v-for="field in ADVANCED_FIELDS" :key="field.name">
              <label :for="`cfg-${field.name}`" class="block text-sm font-medium text-ink">
                {{ field.label }}<span v-if="field.required" class="text-ink-3"> (obligatoire)</span>
              </label>
              <input
                :id="`cfg-${field.name}`"
                v-model="form[field.name]"
                type="text"
                autocomplete="off"
                spellcheck="false"
                :aria-invalid="!!errors[field.name]"
                :class="inputClass(field.name)"
              />
              <p v-if="errors[field.name]" class="mt-1.5 text-sm text-danger">{{ errors[field.name] }}</p>
            </div>
          </div>
        </details>
      </fieldset>

      <div v-if="saveError" role="alert" class="mt-6 rounded-lg border border-danger-line bg-danger-wash p-4">
        <p class="font-semibold text-danger">L’enregistrement a échoué</p>
        <p class="mt-1 text-ink">{{ saveError }}</p>
      </div>

      <div class="mt-6 flex flex-wrap items-center gap-3">
        <AppButton type="submit" :disabled="saving" :aria-busy="saving">
          {{ saving ? 'Enregistrement…' : 'Enregistrer' }}
        </AppButton>
        <AppButton variant="ghost" :disabled="saving || !dirty" @click="fill(config)">Annuler les modifications</AppButton>
        <AppButton
          v-if="config?.source === 'page'"
          variant="secondary"
          class="sm:ml-auto"
          :disabled="saving"
          @click="backToEnv"
        >
          Revenir aux valeurs du .env
        </AppButton>
        <span v-if="notice" class="text-sm font-medium text-success" role="status">{{ notice }}</span>
      </div>
    </form>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import AppButton from './ui/AppButton.vue'
import { getSheetConfig, resetSheetConfig, saveSheetConfig } from '../lib/api.js'
import { formatDateTime } from '../lib/format.js'

const emit = defineEmits(['loaded', 'saved'])

const DOC_FIELDS = [
  {
    name: 'sheet_id',
    label: 'Identifiant ou adresse du document',
    placeholder: 'https://docs.google.com/spreadsheets/d/…/edit',
    help: 'Colle l’adresse du Google Sheet ou seulement la partie entre /d/ et /edit.',
    wide: true,
  },
  {
    name: 'doc_name',
    label: 'Nom du document',
    placeholder: 'overfolio',
    help: 'Utilisé seulement si l’identifiant est vide (demande alors l’API Google Drive).',
  },
  {
    name: 'sync_tabs',
    label: 'Onglets à synchroniser',
    placeholder: 'portfolio, inout, stock, budget, _history',
    help: 'Noms exacts des onglets, séparés par des virgules.',
  },
]

const ACCOUNT_FIELDS = [
  { name: 'client_email', label: 'E-mail du compte de service', type: 'email', required: true },
  { name: 'project_id', label: 'ID du projet', required: true },
  { name: 'private_key_id', label: 'ID de la clé privée' },
  { name: 'client_id', label: 'ID client' },
]

const ADVANCED_FIELDS = [
  { name: 'type', label: 'Type', required: true },
  { name: 'universe_domain', label: 'Domaine (universe_domain)' },
  { name: 'auth_uri', label: 'auth_uri' },
  { name: 'token_uri', label: 'token_uri' },
  { name: 'auth_provider_x509_cert_url', label: 'auth_provider_x509_cert_url' },
  { name: 'client_x509_cert_url', label: 'client_x509_cert_url' },
]

const FIELD_NAMES = [...DOC_FIELDS, ...ACCOUNT_FIELDS, ...ADVANCED_FIELDS].map((field) => field.name)

const config = ref(null)
const loading = ref(true)
const loadError = ref('')
const open = ref(false)

const form = reactive(Object.fromEntries([...FIELD_NAMES, 'private_key'].map((name) => [name, ''])))
const errors = ref({})
const saving = ref(false)
const saveError = ref('')
const notice = ref('')
const importMessage = ref('')
const importError = ref(false)
const fileInput = ref(null)

const keySet = computed(() => !!config.value?.private_key_set)
const keySource = computed(() => (config.value?.source === 'page' ? 'enregistrée sur cette page' : 'lue dans le .env'))
const updatedLabel = computed(() => (config.value?.updated_at ? formatDateTime(config.value.updated_at) : ''))

const dirty = computed(
  () =>
    !!config.value &&
    (form.private_key.trim() !== '' || FIELD_NAMES.some((name) => form[name] !== (config.value.values[name] ?? ''))),
)

function inputClass(name) {
  return [
    'mt-1.5 h-11 w-full rounded-lg border bg-white px-3.5 text-[0.9375rem] text-ink placeholder:text-ink-3',
    errors.value[name] ? 'border-danger' : 'border-line-strong',
  ]
}

function fill(next) {
  if (!next) return
  for (const name of FIELD_NAMES) form[name] = next.values[name] ?? ''
  form.private_key = ''
  errors.value = {}
  saveError.value = ''
  importMessage.value = ''
}

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    config.value = await getSheetConfig()
    fill(config.value)
    // Formulaire ouvert d'office tant que la connexion n'est pas configurée
    if (!config.value.private_key_set || !config.value.values.client_email) open.value = true
    emit('loaded', config.value)
  } catch (err) {
    loadError.value = err.message
  } finally {
    loading.value = false
  }
}

onMounted(load)

let noticeTimer = 0
onBeforeUnmount(() => clearTimeout(noticeTimer))

function showNotice(text) {
  notice.value = text
  clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => {
    notice.value = ''
  }, 6000)
}

async function save() {
  if (saving.value) return
  saving.value = true
  errors.value = {}
  saveError.value = ''
  notice.value = ''
  try {
    config.value = await saveSheetConfig({ ...form })
    fill(config.value)
    showNotice('Paramètres enregistrés. Clique sur Actualiser pour relire un onglet.')
    emit('saved', config.value)
  } catch (err) {
    errors.value = err.fields || {}
    saveError.value = Object.keys(errors.value).length ? 'Corrige les champs signalés.' : err.message
  } finally {
    saving.value = false
  }
}

async function backToEnv() {
  if (!window.confirm('Effacer les valeurs saisies ici et revenir à celles du fichier .env ?')) return
  saving.value = true
  saveError.value = ''
  try {
    config.value = await resetSheetConfig()
    fill(config.value)
    showNotice('Valeurs du .env rétablies.')
    emit('saved', config.value)
  } catch (err) {
    saveError.value = err.message
  } finally {
    saving.value = false
  }
}

// Remplit les champs du compte de service depuis le fichier JSON de Google (lu dans le navigateur, rien n'est envoyé)
async function importJson(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  importError.value = false
  try {
    const data = JSON.parse(await file.text())
    if (data?.type !== 'service_account' || !data.private_key || !data.client_email) {
      throw new Error('ce n’est pas le fichier d’un compte de service Google')
    }
    for (const name of [...ACCOUNT_FIELDS, ...ADVANCED_FIELDS].map((field) => field.name)) {
      if (typeof data[name] === 'string') form[name] = data[name]
    }
    form.private_key = data.private_key
    errors.value = {}
    importMessage.value = `Fichier « ${file.name} » importé. Vérifie puis clique sur Enregistrer.`
  } catch (err) {
    importError.value = true
    importMessage.value = `Import impossible : ${err instanceof SyntaxError ? 'fichier JSON illisible' : err.message}.`
  }
}
</script>
