<!--
  Page « Volatilité » (/volatilite) : la variation du prix de chaque placement sur les périodes choisies (1 mois, 3 mois
  et 1 an par défaut), comme la page « Portfolio Volatility » de l'ancien rapport Data Studio. Un graphique par période :
  on en ajoute ou on en retire avec VolatilityWindows.vue (lib/volatilityWindows.js). Calculs : lib/charts/volatility.js.
-->
<template>
  <div>
    <header class="max-w-3xl">
      <h1 class="text-h2 text-ink">{{ t('pages.volatility') }}</h1>
      <p class="mt-3 text-lead text-ink-2">
        {{ t('volatilityPage.lead', { currency: currencyLabel() }) }}
      </p>
    </header>

    <VolatilityWindows class="mt-6" />

    <ChartGroup class="mt-8" :charts="charts" />

    <p class="mt-12 max-w-2xl border-t border-line pt-6 text-ink-2">
      {{ t('volatilityPage.footer') }}
    </p>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import ChartGroup from '../components/charts/ChartGroup.vue'
import VolatilityWindows from '../components/charts/VolatilityWindows.vue'
import { volatilityChartList } from '../lib/charts/index.js'
import { currencyLabel } from '../lib/format.js'

const { t } = useI18n()

// Un graphique par période choisie : en ajouter ou en retirer met la page à jour (la table n'est pas rechargée)
const charts = computed(() => volatilityChartList())
</script>
