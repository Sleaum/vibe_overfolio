<!--
  Page « Volatilité » (/volatilite) : la variation du prix de chaque placement sur 1 mois, 3 mois et 1 an, comme la page
  « Portfolio Volatility » de l'ancien rapport Data Studio. Graphiques : lib/charts/volatility.js (table _history seule).
-->
<template>
  <div>
    <header class="max-w-3xl">
      <h1 class="text-h2 text-ink">Volatilité</h1>
      <p class="mt-3 text-lead text-ink-2">
        De combien le prix de chacun de tes placements a bougé. Une bulle par placement : à droite ce que tu détiens le
        plus, en bas ce qui a le plus baissé. Le prix est calculé en euros, change compris, sans tes achats ni tes ventes.
      </p>
    </header>

    <ChartGroup class="mt-10" :charts="VOLATILITY_CHARTS" />

    <p class="mt-12 max-w-2xl border-t border-line pt-6 text-ink-2">
      Les variations comparent deux relevés de la table _history : plus tu fais de relevés, plus elles sont précises.
      L’ancien rapport proposait aussi « 1 semaine », qui demande des relevés hebdomadaires.
    </p>
  </div>
</template>

<script setup>
import ChartGroup from '../components/charts/ChartGroup.vue'
import { VOLATILITY_CHARTS } from '../lib/charts/index.js'
</script>
