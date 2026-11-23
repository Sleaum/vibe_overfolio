<!--
  Liste de cartes de graphiques pour une page qui en réunit plusieurs (Portfolio Flow, Enveloppes, Volatilité).
  Chaque table n'est chargée qu'une fois pour toute la page. `transform` (facultatif) modifie une table avant qu'elle
  n'arrive aux graphiques, par exemple pour ne garder qu'une année.
  Expose `tables` (les tables chargées) pour la page qui l'utilise.
-->
<template>
  <div class="space-y-8">
    <ChartCard
      v-for="card in cards"
      :key="card.spec.slug"
      :spec="card.spec"
      :data="card.data"
      :error="card.error"
      :reload="card.reload"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useTable } from '../../composables/useTable.js'
import ChartCard from './ChartCard.vue'

const props = defineProps({
  charts: { type: Array, required: true },
  transform: { type: Function, default: null }, // (table, spec) -> table
})

// Une seule requête par table, même si plusieurs graphiques la lisent (history avec le mois prochain à part)
const tableKey = (spec) => (spec.projection ? `${spec.table}+projection` : spec.table)
const tables = Object.fromEntries(
  [...new Map(props.charts.map((spec) => [tableKey(spec), spec])).entries()].map(([key, spec]) => [
    key,
    useTable(spec.table, { projection: Boolean(spec.projection) }),
  ]),
)

const cards = computed(() =>
  props.charts
    .filter((spec) => !spec.hidden?.()) // graphique qui ne s'affiche que dans un mode (ex. « Tes dettes » en Brut)
    .map((spec) => {
      const table = tables[tableKey(spec)]
      const data = table.data.value
      return {
        spec,
        data: data && props.transform ? props.transform(data, spec) : data,
        error: table.error.value,
        reload: table.reload,
      }
    }),
)

defineExpose({ tables })
</script>
