<!--
  Dessin d'un portefeuille modèle (page Models), en formes géométriques pleines, sans contour, sur une grille de 48.
  All Weather : parapluie demi-cercle, soleil et gouttes · Permanent : quatre quarts de cercle égaux, un par climat ·
  Golden Butterfly : les mêmes quarts en ailes dorées (c'est un Permanent modifié) · Dragon : corps en demi-cercles,
  tête en triangle, flamme · 60/40 : balance, la boule la plus lourde côté actions · Three-Fund : trois barres ·
  Buffett : boule de neige qui grossit en dévalant la pente (sa métaphore des intérêts composés) · Swensen : toque de
  Yale · Coffeehouse : tasse et vapeur · Ivy : feuille en deux verts · Larry : bouclier et flèche montante.
  Couleurs : ILLUSTRATION de lib/palette.js, les mêmes en clair et en sombre.
-->
<template>
  <svg :width="size" :height="size" viewBox="0 0 48 48" role="img" :aria-label="label" class="shrink-0">
    <path v-for="(shape, i) in shapes" :key="i" :d="shape[0]" :fill="C[shape[1]]" />
  </svg>
</template>

<script setup>
import { computed } from 'vue'
import { ILLUSTRATION as C } from '../../lib/palette.js'

const props = defineProps({
  model: { type: String, required: true }, // clé du modèle (lib/models.js)
  label: { type: String, required: true }, // ce que montre le dessin, pour les lecteurs d'écran
  size: { type: Number, default: 40 },
})

/** Cercle plein de centre (x, y) et de rayon r, en chemin SVG. */
const circle = (x, y, r) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`

// Formes de chaque dessin, dans l'ordre (les dernières passent devant) : [chemin, couleur de ILLUSTRATION]
const SHAPES = {
  allWeather: [
    [circle(37, 11, 5), 'yellow'],
    ['M8 27A16 16 0 0 1 40 27Z', 'blue'],
    ['M22.8 29h2.4v9a4 4 0 0 1-8 0h2.4a1.6 1.6 0 0 0 3.2 0z', 'darkGray'],
    ['M10 33h2.2v4h-2.2zM31 33h2.2v4h-2.2z', 'paleBlue'],
  ],
  permanent: [
    ['M23 23H7A16 16 0 0 1 23 7Z', 'blue'],
    ['M25 23V7A16 16 0 0 1 41 23Z', 'green'],
    ['M25 25H41A16 16 0 0 1 25 41Z', 'yellow'],
    ['M23 25V41A16 16 0 0 1 7 25Z', 'silver'],
  ],
  goldenButterfly: [
    ['M23 23H7A16 16 0 0 1 23 7Z', 'yellow'],
    ['M25 23V7A16 16 0 0 1 41 23Z', 'yellow'],
    ['M23 25H12A11 11 0 0 0 23 36Z', 'paleYellow'],
    ['M25 25V36A11 11 0 0 0 36 25Z', 'paleYellow'],
    ['M23 8h2v32h-2z', 'brown'],
  ],
  dragon: [
    ['M4 34A6 6 0 0 1 16 34Z', 'orange'],
    ['M16 34A6 6 0 0 0 28 34Z', 'darkOrange'],
    ['M28 34A5 5 0 0 1 38 34Z', 'orange'],
    ['M34 16L46 22L34 28Z', 'darkOrange'],
    [circle(37.5, 21.5, 1.6), 'palestRed'],
    ['M30 16L34 16L34 20Z', 'orange'],
    ['M46 22L48 19L48 25Z', 'yellow'],
  ],
  sixtyForty: [
    ['M24 22L30 40H18Z', 'gray'],
    ['M6 22.2L42 14L42.6 16.6L6.6 24.8Z', 'darkGray'],
    [circle(10, 32, 7), 'blue'],
    [circle(38, 24.5, 5.6), 'green'],
  ],
  threeFund: [
    ['M7 16a4.5 4.5 0 0 1 9 0V40H7Z', 'blue'],
    ['M19.5 32a4.5 4.5 0 0 1 9 0V40h-9Z', 'paleBlue'],
    ['M32 28a4.5 4.5 0 0 1 9 0V40h-9Z', 'green'],
  ],
  buffett: [
    ['M4 42L44 42L44 40L4 20Z', 'ice'],
    [circle(14, 22, 4), 'red'],
    [circle(24, 26, 6), 'red'],
    [circle(36, 28, 9), 'darkRed'],
    [circle(33.5, 25.5, 2.2), 'paleRed'],
  ],
  swensen: [
    ['M12 22L24 28L36 22V32A12 6 0 0 1 12 32Z', 'darkPurple'],
    ['M24 8L44 18L24 28L4 18Z', 'purple'],
    [circle(24, 18, 2.5), 'yellow'],
    ['M37 21h2.4v12h-2.4z', 'yellow'],
  ],
  coffeehouse: [
    [circle(16, 13, 2), 'paleGray'],
    [circle(22, 9, 2.6), 'silver'],
    [circle(29, 6, 3.2), 'silver'],
    ['M8 20H36V28Q36 40 22 40Q8 40 8 28Z', 'amber'],
    ['M8 20H36V24H8Z', 'coffee'],
    ['M36 23A6 6 0 0 1 36 35V31A2.5 2.5 0 0 0 36 27Z', 'brown'],
  ],
  ivy: [
    ['M24 6L40 22L24 38L8 22Z', 'lightGreen'],
    ['M24 6L40 22L24 38Z', 'green'],
    ['M22.8 38h2.4v6h-2.4z', 'darkGreen'],
  ],
  larry: [
    ['M24 5L40 11V22Q40 35 24 43Q8 35 8 22V11Z', 'teal'],
    ['M24 14L32 28H16Z', 'paleTeal'],
    ['M21.5 28h5v7h-5z', 'paleTeal'],
  ],
}

const shapes = computed(() => SHAPES[props.model] ?? [])
</script>
