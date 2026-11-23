<!--
  Choix des devises du graphique « Patrimoine par devise » : une case à bascule par devise disponible
  (aria-pressed). Au moins une reste cochée. Le choix est enregistré sur le profil (lib/currencies.js).
  Props : `available` (codes qui ont une colonne), `selected` (codes affichés), `more` (codes que le serveur peut
  calculer en plus, taux BCE) : menu « Ajouter une devise ». Événement `changed` après l'ajout d'une devise : la page
  recharge la table pour recevoir sa colonne.
-->
<template>
  <div class="flex flex-wrap items-center gap-2" role="group" :aria-label="t('currencyPicker.label')" data-testid="currency-picker">
    <span class="text-sm text-ink-2">{{ t('currencyPicker.label') }}</span>
    <button
      v-for="code in available"
      :key="code"
      type="button"
      class="h-8 rounded-full border px-3 text-sm font-medium transition-colors disabled:cursor-not-allowed"
      :class="
        selected.includes(code)
          ? 'border-accent bg-accent-wash text-accent'
          : 'border-line-strong text-ink-2 hover:bg-wash hover:text-ink'
      "
      :aria-pressed="selected.includes(code)"
      :disabled="selected.includes(code) && selected.length === 1"
      :title="selected.includes(code) && selected.length === 1 ? t('currencyPicker.keepOne') : undefined"
      :data-testid="`currency-${code}`"
      @click="toggle(code)"
    >
      {{ code }}
    </button>
    <label v-if="more.length" class="relative inline-flex">
      <span class="sr-only">{{ t('currencyPicker.add') }}</span>
      <select
        class="h-8 appearance-none rounded-full border border-dashed border-line-strong bg-paper pl-3 pr-8 text-sm text-ink-2 hover:text-ink"
        :value="''"
        :disabled="busy"
        data-testid="currency-add"
        @change="add($event.target.value)"
      >
        <option value="">{{ t('currencyPicker.add') }}</option>
        <option v-for="code in more" :key="code" :value="code">{{ code }}</option>
      </select>
      <svg viewBox="0 0 20 20" class="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M5 8l5 5 5-5" />
      </svg>
    </label>
    <span v-if="currencyError" role="alert" class="text-sm text-danger">{{ currencyError }}</span>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { currencyError, setChartCurrencies } from '../../lib/currencies.js'

const props = defineProps({
  available: { type: Array, required: true },
  selected: { type: Array, required: true },
  more: { type: Array, default: () => [] },
})
const emit = defineEmits(['changed'])

const { t } = useI18n()
const busy = ref(false)

// Nouvelle devise : enregistrée, puis la table est rechargée pour recevoir sa colonne
async function add(code) {
  if (!code) return
  busy.value = true
  try {
    if (await setChartCurrencies([...props.selected, code])) emit('changed')
  } finally {
    busy.value = false
  }
}

function toggle(code) {
  const next = props.selected.includes(code)
    ? props.selected.filter((item) => item !== code)
    : props.available.filter((item) => item === code || props.selected.includes(item))
  if (next.length) setChartCurrencies(next)
}
</script>
