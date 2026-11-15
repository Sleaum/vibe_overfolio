<!--
  Enveloppe d'un graphique ECharts : taille, texte alternatif et animations coupées si demandé.
  `option` vient de lib/charts/*.js ; `label` décrit le graphique pour les lecteurs d'écran
  (la vue « Tableau » donne les mêmes chiffres en texte).
-->
<template>
  <div
    class="w-full overflow-x-auto"
    :tabindex="minWidth ? 0 : undefined"
    :role="minWidth ? 'region' : undefined"
    :aria-label="minWidth ? `${label} (défilement horizontal)` : undefined"
  >
    <VChart
      class="w-full"
      :style="{ height: `${height}px`, minWidth: minWidth ? `${minWidth}px` : undefined }"
      :option="finalOption"
      :update-options="{ notMerge: true }"
      autoresize
      role="img"
      :aria-label="label"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import VChart from 'vue-echarts'
import '../../lib/echartsSetup.js'
import { useReducedMotion } from '../../composables/useReducedMotion.js'

const props = defineProps({
  option: { type: Object, required: true },
  height: { type: Number, default: 360 },
  minWidth: { type: Number, default: 0 },
  label: { type: String, default: 'Graphique' },
})

const reducedMotion = useReducedMotion()

const finalOption = computed(() =>
  reducedMotion.value ? { ...props.option, animation: false } : props.option,
)
</script>
