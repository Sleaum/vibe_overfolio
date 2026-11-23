<!--
  Choix de périodes : une pastille par période affichée (un clic la retire, la dernière reste), et un champ pour en
  ajouter une (un nombre de mois ou de jours). Choix gardé par le navigateur, et sur le compte si l'on est connecté
  (lib/windows.js). Props : `store` (createWindows()), `format` (période -> texte : « 3 mois », « 30 jours »),
  `unit` (« months » ou « days » : textes du champ), `testid`. Utilisé par la page Volatility (mois) et le graphique
  « Variation des prix par sous-type » de Snapshot (jours).
-->
<template>
  <div class="flex flex-wrap items-center gap-2" role="group" :aria-label="t('windowsPicker.label')" :data-testid="testid">
    <span class="text-sm text-ink-2">{{ t('windowsPicker.label') }}</span>
    <button
      v-for="value in store.list.value"
      :key="value"
      type="button"
      class="inline-flex h-8 items-center gap-1.5 rounded-full border border-accent bg-accent-wash pl-3 pr-2 text-sm font-medium text-accent transition-colors hover:bg-wash disabled:cursor-not-allowed disabled:pr-3"
      :disabled="store.list.value.length === 1"
      :title="store.list.value.length === 1 ? t('windowsPicker.keepOne') : t('windowsPicker.remove', { period: format(value) })"
      :aria-label="t('windowsPicker.remove', { period: format(value) })"
      :data-testid="`window-${value}`"
      @click="remove(value)"
    >
      {{ format(value) }}
      <svg v-if="store.list.value.length > 1" viewBox="0 0 20 20" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
        <path d="M6 6l8 8M14 6l-8 8" />
      </svg>
    </button>
    <form v-if="store.list.value.length < store.maxCount" class="inline-flex items-center gap-1" novalidate @submit.prevent="add">
      <label class="sr-only" :for="inputId">{{ t(`windowsPicker.${unit}.addLabel`) }}</label>
      <input
        :id="inputId"
        v-model="draft"
        type="number"
        inputmode="numeric"
        min="1"
        :max="store.maxValue"
        step="1"
        :placeholder="t(`windowsPicker.${unit}.placeholder`)"
        class="h-8 w-24 rounded-full border border-dashed border-line-strong bg-paper px-3 text-sm tabular-nums text-ink placeholder:text-ink-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        data-testid="window-add-input"
      />
      <button
        type="submit"
        class="h-8 rounded-full border border-line-strong px-3 text-sm font-medium text-ink-2 hover:bg-wash hover:text-ink"
        data-testid="window-add"
      >
        {{ t('windowsPicker.add') }}
      </button>
    </form>
    <span v-if="message" role="alert" class="text-sm text-danger">{{ message }}</span>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  store: { type: Object, required: true },
  format: { type: Function, required: true },
  unit: { type: String, default: 'months' }, // 'months' ou 'days'
  testid: { type: String, default: 'windows-picker' },
})

const { t } = useI18n()

const inputId = `${props.testid}-add`
const draft = ref('')
const problem = ref('')
const message = computed(() => problem.value || props.store.error.value)

function remove(value) {
  problem.value = ''
  props.store.remove(value)
}

async function add() {
  const result = await props.store.add(draft.value === '' ? NaN : Number(draft.value))
  problem.value =
    result === 'invalid'
      ? t(`windowsPicker.${props.unit}.invalid`, { max: props.store.maxValue })
      : result === 'exists'
        ? t('windowsPicker.exists')
        : result === 'full'
          ? t('windowsPicker.full', { max: props.store.maxCount })
          : ''
  if (result === 'added') draft.value = ''
}
</script>
