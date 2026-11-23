<!--
  Page « Volatilité » (/volatilite) : la variation du prix de chaque placement sur 1 mois, 3 mois et 1 an, comme la page
  « Portfolio Volatility » de l'ancien rapport Data Studio. Graphiques : lib/charts/volatility.js (table history seule).
-->
<template>
  <div>
    <header class="max-w-3xl">
      <h1 class="text-h2 text-ink">{{ t('pages.volatility') }}</h1>
      <p class="mt-3 text-lead text-ink-2">
        {{ t('volatilityPage.lead', { currency: currencyLabel() }) }}
      </p>
    </header>

    <ChartGroup class="mt-10" :charts="VOLATILITY_CHARTS" />

    <p class="mt-12 max-w-2xl border-t border-line pt-6 text-ink-2">
      {{ t('volatilityPage.footer') }}
    </p>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import ChartGroup from '../components/charts/ChartGroup.vue'
import { VOLATILITY_CHARTS } from '../lib/charts/index.js'
import { currencyLabel } from '../lib/format.js'

const { t } = useI18n()
</script>
