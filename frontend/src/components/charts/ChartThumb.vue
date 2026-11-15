<!--
  Miniatures de la page d'index des graphiques. Ce sont des illustrations statiques du type de graphique
  (pas de données réelles) : aucune requête, affichage instantané. Mêmes couleurs que les vrais graphiques.
-->
<template>
  <svg
    viewBox="0 0 240 120"
    class="block h-auto w-full"
    role="presentation"
    aria-hidden="true"
    focusable="false"
  >
    <!-- Courbe : patrimoine dans le temps -->
    <g v-if="kind === 'line'">
      <line x1="16" x2="224" y1="100" y2="100" :stroke="AXIS" stroke-width="1.5" />
      <line x1="16" x2="224" y1="62" y2="62" :stroke="GRID" stroke-width="1" />
      <line x1="16" x2="224" y1="24" y2="24" :stroke="GRID" stroke-width="1" />
      <path d="M16 84 L48 76 L80 80 L112 62 L144 66 L176 44 L208 30 L208 100 L16 100 Z" :fill="SERIES[0]" fill-opacity="0.1" />
      <path
        d="M16 84 L48 76 L80 80 L112 62 L144 66 L176 44 L208 30"
        fill="none"
        :stroke="SERIES[0]"
        stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <circle cx="208" cy="30" r="6" :fill="SERIES[0]" :stroke="SURFACE" stroke-width="3" />
    </g>

    <!-- Anneau : types d'actifs -->
    <g v-else-if="kind === 'donut'">
      <circle
        v-for="(segment, index) in ring"
        :key="index"
        cx="120"
        cy="60"
        r="34"
        fill="none"
        :stroke="segment.color"
        stroke-width="20"
        :stroke-dasharray="segment.dash"
        :stroke-dashoffset="segment.offset"
        transform="rotate(-90 120 60)"
      />
    </g>

    <!-- Barres horizontales triées : zones -->
    <g v-else-if="kind === 'bars'">
      <line x1="56" x2="56" y1="14" y2="106" :stroke="AXIS" stroke-width="1.5" />
      <g v-for="(width, index) in [150, 118, 92, 62, 40]" :key="index">
        <rect x="16" :y="19 + index * 18" width="28" height="5" rx="2.5" :fill="AXIS" />
        <rect x="56" :y="15 + index * 18" :width="width" height="12" rx="3" :fill="SERIES[0]" />
      </g>
    </g>

    <!-- Barres empilées : comptes -->
    <g v-else-if="kind === 'stacked'">
      <line x1="56" x2="56" y1="14" y2="106" :stroke="AXIS" stroke-width="1.5" />
      <g v-for="(bar, index) in stackRows" :key="index">
        <rect x="16" :y="21 + index * 22" width="28" height="5" rx="2.5" :fill="AXIS" />
        <rect
          v-for="(segment, s) in bar"
          :key="s"
          :x="segment.x"
          :y="16 + index * 22"
          :width="segment.width"
          height="15"
          rx="2"
          :fill="SERIES[s]"
        />
      </g>
    </g>

    <!-- Classement : plus grosses positions -->
    <g v-else-if="kind === 'rank'">
      <line x1="56" x2="56" y1="10" y2="110" :stroke="AXIS" stroke-width="1.5" />
      <g v-for="(width, index) in [152, 128, 106, 92, 74, 58, 44, 30]" :key="index">
        <rect x="16" :y="14 + index * 12" width="28" height="4" rx="2" :fill="AXIS" />
        <rect x="56" :y="12 + index * 12" :width="width" height="8" rx="2.5" :fill="SERIES[0]" />
      </g>
    </g>

    <!-- Flux : budget -->
    <g v-else-if="kind === 'sankey'">
      <path d="M28 38 C 66 38, 66 32, 104 32" fill="none" :stroke="SERIES[0]" stroke-opacity="0.28" stroke-width="36" />
      <path d="M28 76 C 66 76, 66 78, 104 78" fill="none" :stroke="SERIES[0]" stroke-opacity="0.28" stroke-width="28" />
      <path d="M112 24 C 150 24, 150 22, 188 22" fill="none" :stroke="SERIES[0]" stroke-opacity="0.28" stroke-width="16" />
      <path d="M112 42 C 150 42, 150 60, 188 60" fill="none" :stroke="SERIES[0]" stroke-opacity="0.28" stroke-width="16" />
      <path d="M112 78 C 150 78, 150 88, 188 88" fill="none" :stroke="SERIES[0]" stroke-opacity="0.28" stroke-width="24" />
      <rect x="20" y="20" width="8" height="76" rx="2" :fill="SERIES[0]" />
      <rect x="104" y="14" width="8" height="36" rx="2" :fill="SERIES[0]" />
      <rect x="104" y="64" width="8" height="28" rx="2" :fill="SERIES[0]" />
      <rect x="188" y="14" width="8" height="16" rx="2" :fill="SERIES[0]" />
      <rect x="188" y="52" width="8" height="16" rx="2" :fill="SERIES[0]" />
      <rect x="188" y="76" width="8" height="24" rx="2" :fill="SERIES[0]" />
    </g>

    <!-- Barres groupées par mois : entrées et sorties -->
    <g v-else-if="kind === 'grouped'">
      <line x1="16" x2="224" y1="100" y2="100" :stroke="AXIS" stroke-width="1.5" />
      <line x1="16" x2="224" y1="52" y2="52" :stroke="GRID" stroke-width="1" />
      <g v-for="(pair, index) in [[46, 30], [58, 36], [40, 44], [66, 38], [52, 34], [70, 42]]" :key="index">
        <rect :x="26 + index * 34" :y="100 - pair[0]" width="12" :height="pair[0]" rx="2.5" :fill="SERIES[0]" />
        <rect :x="40 + index * 34" :y="100 - pair[1]" width="12" :height="pair[1]" rx="2.5" :fill="SERIES[1]" />
      </g>
    </g>
  </svg>
</template>

<script setup>
import { AXIS, GRID, SERIES, SURFACE } from '../../lib/palette.js'

defineProps({
  kind: { type: String, required: true }, // line | donut | bars | stacked | rank | sankey | grouped
})

// Anneau : 4 parts, séparées par un petit vide
const CIRCUMFERENCE = 2 * Math.PI * 34
const GAP = 3
const ring = (() => {
  let start = 0
  return [0.42, 0.26, 0.18, 0.14].map((share, index) => {
    const length = share * CIRCUMFERENCE
    const segment = {
      color: SERIES[index],
      dash: `${(length - GAP).toFixed(2)} ${(CIRCUMFERENCE - length + GAP).toFixed(2)}`,
      offset: (-start).toFixed(2),
    }
    start += length
    return segment
  })
})()

// Barres empilées : trois segments par barre, séparés de 2 px
const stackRows = [
  [100, 40, 20],
  [78, 52, 14],
  [64, 30, 40],
  [40, 36, 12],
].map((widths) => {
  let x = 56
  return widths.map((width) => {
    const segment = { x, width }
    x += width + 2
    return segment
  })
})
</script>
