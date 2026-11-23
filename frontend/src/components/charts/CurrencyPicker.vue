<!--
  Choix des devises du graphique « Patrimoine par devise » : une case à bascule par devise disponible
  (aria-pressed). Au moins une reste cochée. Le choix est enregistré sur le profil (lib/currencies.js).
  Props : `available` (codes disponibles), `selected` (codes affichés).
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
    <span v-if="currencyError" role="alert" class="text-sm text-danger">{{ currencyError }}</span>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { currencyError, setChartCurrencies } from '../../lib/currencies.js'

const props = defineProps({
  available: { type: Array, required: true },
  selected: { type: Array, required: true },
})

const { t } = useI18n()

function toggle(code) {
  const next = props.selected.includes(code)
    ? props.selected.filter((item) => item !== code)
    : props.available.filter((item) => item === code || props.selected.includes(item))
  if (next.length) setChartCurrencies(next)
}
</script>
