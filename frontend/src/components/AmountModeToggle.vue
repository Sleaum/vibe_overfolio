<!--
  Bouton Brut / Net (lib/amounts.js), en haut du menu des rubriques Charts et Models : montants bruts (tes actifs)
  ou nets (actifs moins dettes), avec une phrase qui dit ce que le choix change. Choix gardé par le navigateur.
-->
<template>
  <div class="mb-5 lg:px-3">
    <SegmentedControl
      :model-value="amountMode"
      :options="options"
      :label="t('amounts.label')"
      @update:model-value="setAmountMode"
    />
    <p class="mt-2 max-w-xs text-xs text-ink-3">{{ t(`amounts.help.${amountMode}`) }}</p>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import SegmentedControl from './ui/SegmentedControl.vue'
import { AMOUNT_MODES, amountMode, setAmountMode } from '../lib/amounts.js'

const { t } = useI18n()
const options = computed(() => AMOUNT_MODES.map((mode) => ({ value: mode, label: t(`amounts.mode.${mode}`) })))
</script>
