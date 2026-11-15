<!--
  Miniatures de la page d'index des graphiques. Ce sont des illustrations statiques du type de graphique
  (pas de données réelles) : aucune requête, affichage instantané. Mêmes couleurs que les vrais graphiques.
  Types : line (historique), donut (anneau), sunburst (anneaux à deux niveaux), sankey (flux).
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
        v-for="(segment, index) in donutRing"
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

    <!-- Anneaux à deux niveaux : catégories au centre, détail autour en nuances de la même couleur -->
    <g v-else-if="kind === 'sunburst'">
      <circle
        v-for="(segment, index) in sunburstInner"
        :key="`i${index}`"
        cx="120"
        cy="60"
        r="22"
        fill="none"
        :stroke="segment.color"
        stroke-width="16"
        :stroke-dasharray="segment.dash"
        :stroke-dashoffset="segment.offset"
        transform="rotate(-90 120 60)"
      />
      <circle
        v-for="(segment, index) in sunburstOuter"
        :key="`o${index}`"
        cx="120"
        cy="60"
        r="40"
        fill="none"
        :stroke="segment.color"
        stroke-width="16"
        :stroke-dasharray="segment.dash"
        :stroke-dashoffset="segment.offset"
        transform="rotate(-90 120 60)"
      />
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
  </svg>
</template>

<script setup>
import { AXIS, GRID, SERIES, SURFACE } from '../../lib/palette.js'
import { tint } from '../../lib/strategy.js'

defineProps({
  kind: { type: String, required: true }, // line | donut | sunburst | sankey
})

const GAP = 3 // petit vide entre deux parts

/** Parts d'un cercle : [{ share, color }] -> dasharray / dashoffset de chaque arc, pour un cercle de ce rayon. */
function arcs(radius, items) {
  const circumference = 2 * Math.PI * radius
  let start = 0
  return items.map(({ share, color }) => {
    const length = share * circumference
    const segment = {
      color,
      dash: `${(length - GAP).toFixed(2)} ${(circumference - length + GAP).toFixed(2)}`,
      offset: (-start).toFixed(2),
    }
    start += length
    return segment
  })
}

// Anneau : 4 parts
const donutRing = arcs(
  34,
  [0.42, 0.26, 0.18, 0.14].map((share, index) => ({ share, color: SERIES[index] })),
)

// Deux niveaux : 4 catégories, chacune découpée en 1 ou 2 détails plus clairs
const CATEGORIES = [
  { share: 0.42, details: [0.26, 0.16] },
  { share: 0.26, details: [0.14, 0.12] },
  { share: 0.18, details: [0.18] },
  { share: 0.14, details: [0.08, 0.06] },
]
const sunburstInner = arcs(
  22,
  CATEGORIES.map((category, index) => ({ share: category.share, color: SERIES[index] })),
)
const sunburstOuter = arcs(
  40,
  CATEGORIES.flatMap((category, index) =>
    category.details.map((share, detail) => ({ share, color: tint(SERIES[index], 0.3 + 0.3 * detail) })),
  ),
)
</script>
