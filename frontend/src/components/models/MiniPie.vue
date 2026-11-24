<!--
  Petit camembert en SVG (page Models) : une part par tranche, le pourcentage écrit dans les parts de 15 % ou plus
  (camembert de 56 px et plus),
  chaque part détaillée au survol (title) et l'ensemble lu par les lecteurs d'écran (aria-label).
  En SVG plutôt qu'en ECharts : léger (onze camemberts sur la page) et bien rendu par l'export PDF.
  Couleurs fournies par la page (lib/models.js, d'après palette.js) ; filets entre les parts couleur du fond (stroke-paper).
-->
<template>
  <svg :width="size" :height="size" :viewBox="`0 0 ${size} ${size}`" role="img" :aria-label="summary">
    <circle v-if="parts.length === 1" :cx="center" :cy="center" :r="radius" :fill="parts[0].color">
      <title>{{ parts[0].title }}</title>
    </circle>
    <template v-else>
      <path v-for="part in parts" :key="part.id" :d="part.d" :fill="part.color" class="stroke-paper" stroke-width="1">
        <title>{{ part.title }}</title>
      </path>
    </template>
    <text
      v-for="part in labelled"
      :key="`t-${part.id}`"
      :x="part.lx"
      :y="part.ly"
      text-anchor="middle"
      dominant-baseline="central"
      font-size="11"
      font-weight="600"
      :fill="part.text"
      pointer-events="none"
    >
      {{ part.label }}
    </text>
  </svg>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatDecimal } from '../../lib/format.js'
import { textOn } from '../../lib/palette.js'

const props = defineProps({
  // [{ label, value (en %), color }]
  slices: { type: Array, required: true },
  size: { type: Number, default: 64 },
})

const { t } = useI18n()
const center = computed(() => props.size / 2)
const radius = computed(() => props.size / 2 - 1)
const total = computed(() => props.slices.reduce((sum, s) => sum + s.value, 0) || 1)

const point = (angle, r) => [center.value + r * Math.cos(angle), center.value + r * Math.sin(angle)]
const round = (n) => Math.round(n * 100) / 100

const parts = computed(() => {
  let angle = -Math.PI / 2
  return props.slices
    .filter((s) => s.value > 0)
    .map((slice, id) => {
      const sweep = (slice.value / total.value) * 2 * Math.PI
      const [x1, y1] = point(angle, radius.value)
      const [x2, y2] = point(angle + sweep, radius.value)
      const [lx, ly] = point(angle + sweep / 2, radius.value * 0.6)
      const value = formatDecimal(slice.value)
      const part = {
        id,
        color: slice.color,
        text: textOn(slice.color),
        d: `M${center.value} ${center.value} L${round(x1)} ${round(y1)} A${radius.value} ${radius.value} 0 ${sweep > Math.PI ? 1 : 0} 1 ${round(x2)} ${round(y2)}Z`,
        lx: round(lx),
        ly: round(ly),
        value: slice.value,
        label: value,
        title: t('modelsPage.sliceTitle', { label: slice.label, value }),
      }
      angle += sweep
      return part
    })
})

// Pourcentages écrits seulement s'il y a la place (56 px et plus) ; sinon, au survol
const labelled = computed(() => (parts.value.length === 1 || props.size < 56 ? [] : parts.value.filter((p) => p.value >= 15)))
const summary = computed(() => parts.value.map((p) => p.title).join(', '))
</script>
