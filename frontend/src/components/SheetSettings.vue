<!--
  Paramètres d'accès au Google Sheet (page GoogleSheet).
  - Les champs sont préremplis avec les valeurs en vigueur : celles enregistrées ici, sinon celles du .env.
  - La clé privée n'est jamais renvoyée par le serveur : laissée vide, la clé en vigueur est conservée.
  - « Importer le fichier JSON » remplit les champs du compte de service depuis le fichier téléchargé dans Google Cloud.
  - Événements : `loaded` et `saved` avec la configuration ({ source, values, private_key_set, … }).
-->
<template>
  <section class="mt-10 rounded-xl border border-line bg-paper shadow-soft" aria-labelledby="sheet-settings-title">
    <div class="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 id="sheet-settings-title" class="text-h3 text-ink">{{ t('sheetSettings.title') }}</h2>
        <p class="mt-1 text-sm text-ink-2" aria-live="polite">
          <template v-if="loading">{{ t('sheetSettings.loading') }}</template>
          <template v-else-if="loadError">{{ t('sheetSettings.unavailable') }}</template>
          <template v-else-if="config?.source === 'page'">
            {{ updatedLabel ? t('sheetSettings.savedHereOn', { date: updatedLabel }) : t('sheetSettings.savedHere') }}
          </template>
          <template v-else>{{ t('sheetSettings.fromEnv') }}</template>
          <span v-if="!loading && !loadError && config?.values.client_email">
            {{ t('sheetSettings.readBy', { email: config.values.client_email }) }}
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
        {{ open ? t('sheetSettings.hide') : t('sheetSettings.edit') }}
      </AppButton>
    </div>

    <div v-if="loadError" role="alert" class="mx-5 mb-5 rounded-lg border border-danger-line bg-danger-wash p-4">
      <p class="text-ink">{{ loadError }}</p>
      <AppButton variant="secondary" size="sm" class="mt-3" @click="load">{{ t('chartUi.retry') }}</AppButton>
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
        <legend class="text-sm font-semibold uppercase tracking-wide text-ink-2">{{ t('sheetSettings.document') }}</legend>
        <div class="mt-4 grid gap-5 md:grid-cols-2">
          <div v-for="field in DOC_FIELDS" :key="field.name" :class="field.wide ? 'md:col-span-2' : ''">
            <label :for="`cfg-${field.name}`" class="block text-sm font-medium text-ink">{{ t(`sheetSettings.fields.${field.name}`) }}</label>
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
              {{ errors[field.name] || t(`sheetSettings.help.${field.name}`) }}
            </p>
          </div>
        </div>
      </fieldset>

      <!-- Compte de service -->
      <fieldset class="mt-8">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <legend class="text-sm font-semibold uppercase tracking-wide text-ink-2">{{ t('sheetSettings.account') }}</legend>
          <div>
            <input ref="fileInput" type="file" accept="application/json,.json" class="sr-only" tabindex="-1" @change="importJson" />
            <AppButton variant="outline" size="sm" @click="fileInput?.click()">{{ t('sheetSettings.importJson') }}</AppButton>
          </div>
        </div>
        <p class="mt-2 text-sm text-ink-3">
          {{ t('sheetSettings.accountHelp') }}
        </p>
        <p v-if="importMessage" class="mt-2 text-sm" :class="importError ? 'text-danger' : 'text-success'" role="status">
          {{ importMessage }}
        </p>

        <div class="mt-4 grid gap-5 md:grid-cols-2">
          <div v-for="field in ACCOUNT_FIELDS" :key="field.name">
            <label :for="`cfg-${field.name}`" class="block text-sm font-medium text-ink">
              {{ t(`sheetSettings.fields.${field.name}`) }}<span v-if="field.required" class="text-ink-3">{{ t('sheetSettings.required') }}</span>
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
              {{ t('sheetSettings.fields.private_key') }}<span class="text-ink-3">{{ t('sheetSettings.required') }}</span>
            </label>
            <textarea
              id="cfg-private_key"
              v-model="form.private_key"
              rows="4"
              autocomplete="off"
              spellcheck="false"
              :placeholder="
                keySet
                  ? t('sheetSettings.keyAlreadySet')
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
                  ? t('sheetSettings.keyInPlace', { source: keySource })
                  : t('sheetSettings.noKey'))
              }}
            </p>
          </div>
        </div>

        <details class="mt-6 rounded-lg border border-line">
          <summary class="cursor-pointer select-none px-4 py-3 text-sm font-medium text-ink">
            {{ t('sheetSettings.advanced') }}
          </summary>
          <div class="grid gap-5 border-t border-line p-4 md:grid-cols-2">
            <div v-for="field in ADVANCED_FIELDS" :key="field.name">
              <label :for="`cfg-${field.name}`" class="block text-sm font-medium text-ink">
                {{ t(`sheetSettings.fields.${field.name}`) }}<span v-if="field.required" class="text-ink-3">{{ t('sheetSettings.required') }}</span>
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
        <p class="font-semibold text-danger">{{ t('sheetSettings.saveFailed') }}</p>
        <p class="mt-1 text-ink">{{ saveError }}</p>
      </div>

      <div class="mt-6 flex flex-wrap items-center gap-3">
        <AppButton type="submit" :disabled="saving" :aria-busy="saving">
          {{ saving ? t('sheetSettings.saving') : t('sheetSettings.save') }}
        </AppButton>
        <AppButton variant="ghost" :disabled="saving || !dirty" @click="fill(config)">{{ t('sheetSettings.cancel') }}</AppButton>
        <AppButton
          v-if="config?.source === 'page'"
          variant="secondary"
          class="sm:ml-auto"
          :disabled="saving"
          @click="backToEnv"
        >
          {{ t('sheetSettings.backToEnv') }}
        </AppButton>
        <span v-if="notice" class="text-sm font-medium text-success" role="status">{{ notice }}</span>
      </div>
    </form>
  </section>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import AppButton from './ui/AppButton.vue'
import { getSheetConfig, resetSheetConfig, saveSheetConfig } from '../lib/api.js'
import { formatDateTime } from '../lib/format.js'

const { t } = useI18n()

const emit = defineEmits(['loaded', 'saved'])

// Noms et aides des champs : rubrique sheetSettings.fields / sheetSettings.help de i18n/*.json
const DOC_FIELDS = [
  {
    name: 'sheet_id',
    placeholder: 'https://docs.google.com/spreadsheets/d/…/edit',
    wide: true,
  },
  {
    name: 'doc_name',
    placeholder: 'overfolio',
  },
  {
    name: 'sync_tabs',
    placeholder: 'portfolio, inout, stock, budget, _history',
  },
]

const ACCOUNT_FIELDS = [
  { name: 'client_email', type: 'email', required: true },
  { name: 'project_id', required: true },
  { name: 'private_key_id' },
  { name: 'client_id' },
]

const ADVANCED_FIELDS = [
  { name: 'type', required: true },
  { name: 'universe_domain' },
  { name: 'auth_uri' },
  { name: 'token_uri' },
  { name: 'auth_provider_x509_cert_url' },
  { name: 'client_x509_cert_url' },
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
const keySource = computed(() =>
  config.value?.source === 'page' ? t('sheetSettings.keySourcePage') : t('sheetSettings.keySourceEnv'),
)
const updatedLabel = computed(() => (config.value?.updated_at ? formatDateTime(config.value.updated_at) : ''))

const dirty = computed(
  () =>
    !!config.value &&
    (form.private_key.trim() !== '' || FIELD_NAMES.some((name) => form[name] !== (config.value.values[name] ?? ''))),
)

function inputClass(name) {
  return [
    'mt-1.5 h-11 w-full rounded-lg border bg-paper px-3.5 text-[0.9375rem] text-ink placeholder:text-ink-3',
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
    showNotice(t('sheetSettings.savedNotice'))
    emit('saved', config.value)
  } catch (err) {
    errors.value = err.fields || {}
    saveError.value = Object.keys(errors.value).length ? t('sheetSettings.fixFields') : err.message
  } finally {
    saving.value = false
  }
}

async function backToEnv() {
  if (!window.confirm(t('sheetSettings.confirmEnv'))) return
  saving.value = true
  saveError.value = ''
  try {
    config.value = await resetSheetConfig()
    fill(config.value)
    showNotice(t('sheetSettings.envRestored'))
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
      throw new Error(t('sheetSettings.notServiceAccount'))
    }
    for (const name of [...ACCOUNT_FIELDS, ...ADVANCED_FIELDS].map((field) => field.name)) {
      if (typeof data[name] === 'string') form[name] = data[name]
    }
    form.private_key = data.private_key
    errors.value = {}
    importMessage.value = t('sheetSettings.imported', { file: file.name })
  } catch (err) {
    importError.value = true
    importMessage.value = t('sheetSettings.importFailed', {
      reason: err instanceof SyntaxError ? t('sheetSettings.unreadableJson') : err.message,
    })
  }
}
</script>
