<!--
  Enveloppe d'un graphique ECharts : taille, texte alternatif, animations coupées si demandé, couleurs du mode sombre.
  `option` vient de lib/charts/*.js ; `label` décrit le graphique pour les lecteurs d'écran
  (la vue « Tableau » donne les mêmes chiffres en texte).
-->
<template>
  <div
    class="w-full overflow-x-auto"
    :tabindex="minWidth ? 0 : undefined"
    :role="minWidth ? 'region' : undefined"
    :aria-label="minWidth ? t('chartUi.horizontalScroll', { label: chartLabel }) : undefined"
  >
    <VChart
      class="w-full"
      :style="{ height: `${height}px`, minWidth: minWidth ? `${minWidth}px` : undefined }"
      :option="finalOption"
      :update-options="{ notMerge: true }"
      autoresize
      role="img"
      :aria-label="chartLabel"
    />
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { computed } from 'vue'
import VChart from 'vue-echarts'
import '../../lib/echartsSetup.js'
import { useReducedMotion } from '../../composables/useReducedMotion.js'
import { pdfExport } from '../../lib/pdfExport.js'
import { useTheme } from '../../composables/useTheme.js'
import { toDark } from '../../lib/chartDark.js'

const { t } = useI18n()
const chartLabel = computed(() => props.label || t('chartUi.chartDefault'))

const props = defineProps({
  option: { type: Object, required: true },
  height: { type: Number, default: 360 },
  minWidth: { type: Number, default: 0 },
  label: { type: String, default: '' }, // vide : « Graphique » dans la langue active
})

const reducedMotion = useReducedMotion()
// Pendant l'export PDF (bouton PDF de l'en-tête) : pas d'animation, le graphique est complet dès qu'il est dessiné

const { isDark } = useTheme()

const finalOption = computed(() => {
  const option = isDark.value ? toDark(props.option) : props.option
  return reducedMotion.value || pdfExport.running ? { ...option, animation: false } : option
})
</script>
