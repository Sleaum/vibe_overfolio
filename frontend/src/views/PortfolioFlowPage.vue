<!--
  Page « Portfolio Flow » (/portfolio-flow) : l'historique du patrimoine mois par mois, en cinq graphiques sur une seule page.
  Les graphiques viennent de lib/charts (groupe « flow ») ; chaque table n'est chargée qu'une fois pour toute la page.
-->
<template>
  <div>
    <header class="max-w-3xl">
      <h1 class="text-h2 text-ink">Portfolio Flow</h1>
      <p class="mt-3 text-lead text-ink-2">
        L’historique de ton patrimoine, mois par mois : devises, répartition, évolution par type d’actif, variation et
        tendance. Chaque carte a sa version tableau et sa page d’explication.
      </p>
    </header>

    <div class="mt-10 space-y-8">
      <ChartCard
        v-for="card in cards"
        :key="card.spec.slug"
        :spec="card.spec"
        :data="card.data"
        :error="card.error"
        :reload="card.reload"
      />
    </div>

    <p class="mt-12 max-w-2xl border-t border-line pt-6 text-ink-2">
      Les graphiques lisent la base de données. Pour la mettre à jour depuis ta feuille, utilise le bouton Tout actualiser de la
      page
      <router-link to="/sheet" class="font-semibold text-accent underline underline-offset-4 hover:text-accent-hover">
        GoogleSheet</router-link
      >. Pour ton patrimoine d’aujourd’hui, ouvre
      <router-link to="/portfolio-snapshot" class="font-semibold text-accent underline underline-offset-4 hover:text-accent-hover">
        Portfolio Snapshot</router-link
      >.
    </p>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import ChartCard from '../components/charts/ChartCard.vue'
import { useTable } from '../composables/useTable.js'
import { FLOW_CHARTS } from '../lib/charts/index.js'

// Une seule requête par table, même si plusieurs graphiques la lisent
const tables = Object.fromEntries([...new Set(FLOW_CHARTS.map((spec) => spec.table))].map((name) => [name, useTable(name)]))

const cards = computed(() =>
  FLOW_CHARTS.map((spec) => ({
    spec,
    data: tables[spec.table].data.value,
    error: tables[spec.table].error.value,
    reload: tables[spec.table].reload,
  })),
)
</script>
