<!--
  Périodes de la page Volatility : une pastille par période affichée (un clic la retire, la dernière reste), et un champ
  « nombre de mois » pour en ajouter une (un graphique de plus). Choix gardé par le navigateur, et sur le compte si l'on
  est connecté : lib/volatilityWindows.js.
-->
<template>
  <div class="flex flex-wrap items-center gap-2" role="group" :aria-label="t('volatilityWindows.label')" data-testid="volatility-windows">
    <span class="text-sm text-ink-2">{{ t('volatilityWindows.label') }}</span>
    <button
      v-for="months in volatilityMonths"
      :key="months"
      type="button"
      class="inline-flex h-8 items-center gap-1.5 rounded-full border border-accent bg-accent-wash pl-3 pr-2 text-sm font-medium text-accent transition-colors hover:bg-wash disabled:cursor-not-allowed disabled:pr-3"
      :disabled="volatilityMonths.length === 1"
      :title="volatilityMonths.length === 1 ? t('volatilityWindows.keepOne') : t('volatilityWindows.remove', { period: periodLabel(months) })"
      :aria-label="t('volatilityWindows.remove', { period: periodLabel(months) })"
      :data-testid="`window-${months}`"
      @click="remove(months)"
    >
      {{ periodLabel(months) }}
      <svg v-if="volatilityMonths.length > 1" viewBox="0 0 20 20" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
        <path d="M6 6l8 8M14 6l-8 8" />
      </svg>
    </button>
    <form v-if="volatilityMonths.length < MAX_WINDOWS" class="inline-flex items-center gap-1" novalidate @submit.prevent="add">
      <label class="sr-only" for="volatility-add">{{ t('volatilityWindows.addLabel') }}</label>
      <input
        id="volatility-add"
        v-model="draft"
        type="number"
        inputmode="numeric"
        min="1"
        :max="MAX_MONTHS"
        step="1"
        :placeholder="t('volatilityWindows.placeholder')"
        class="h-8 w-24 rounded-full border border-dashed border-line-strong bg-paper px-3 text-sm tabular-nums text-ink placeholder:text-ink-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        data-testid="window-add-input"
      />
      <button
        type="submit"
        class="h-8 rounded-full border border-line-strong px-3 text-sm font-medium text-ink-2 hover:bg-wash hover:text-ink"
        data-testid="window-add"
      >
        {{ t('volatilityWindows.add') }}
      </button>
    </form>
    <span v-if="message" role="alert" class="text-sm text-danger">{{ message }}</span>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { periodLabel } from '../../lib/charts/volatility.js'
import {
  MAX_MONTHS,
  MAX_WINDOWS,
  addWindow,
  removeWindow,
  volatilityError,
  volatilityMonths,
} from '../../lib/volatilityWindows.js'

const { t } = useI18n()

const draft = ref('')
const problem = ref('')
const message = computed(() => problem.value || volatilityError.value)

function remove(months) {
  problem.value = ''
  removeWindow(months)
}

async function add() {
  const result = await addWindow(draft.value === '' ? NaN : Number(draft.value))
  problem.value =
    result === 'invalid'
      ? t('volatilityWindows.invalid', { max: MAX_MONTHS })
      : result === 'exists'
        ? t('volatilityWindows.exists')
        : result === 'full'
          ? t('volatilityWindows.full', { max: MAX_WINDOWS })
          : ''
  if (result === 'added') draft.value = ''
}
</script>
