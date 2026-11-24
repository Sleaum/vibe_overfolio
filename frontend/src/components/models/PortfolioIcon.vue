<!--
  Dessin d'un portefeuille modèle (page Models) : un objet qui le résume.
  All Weather : parapluie sous le soleil et la pluie · Permanent : trèfle à quatre feuilles égales · Golden Butterfly :
  papillon doré · Dragon : dragon · 60/40 : balance · Three-Fund : trident · Buffett : cible · Swensen : toque de Yale ·
  Coffeehouse : tasse de café · Ivy : feuille de lierre · Larry : bouclier et flèche montante.
  Couleurs : ILLUSTRATION de lib/palette.js ; les traits neutres suivent le texte (currentColor, mode clair ou sombre).
-->
<template>
  <svg :width="size" :height="size" viewBox="0 0 52 52" role="img" :aria-label="label" class="shrink-0 text-ink-3">
    <template v-if="model === 'allWeather'">
      <circle cx="41" cy="11" r="6" :fill="C.yellow" />
      <path d="M6 30 Q26 4 46 30 Q41 25.5 36 30 Q31 25.5 26 30 Q21 25.5 16 30 Q11 25.5 6 30Z" :fill="C.blue" />
      <line x1="26" y1="30" x2="26" y2="44" stroke="currentColor" stroke-width="2" />
      <path d="M26 44 Q26 49 21.5 47.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      <g :stroke="C.paleBlue" stroke-width="1.8" stroke-linecap="round">
        <line x1="9" y1="36" x2="7" y2="40" /><line x1="15" y1="40" x2="13" y2="44" />
        <line x1="40" y1="37" x2="38" y2="41" /><line x1="45" y1="42" x2="43" y2="46" />
      </g>
    </template>

    <template v-else-if="model === 'permanent'">
      <path d="M27 27 Q31 40 40 48" fill="none" :stroke="C.green" stroke-width="2.2" stroke-linecap="round" />
      <circle cx="18" cy="18" r="8" :fill="C.blue" />
      <circle cx="34" cy="18" r="8" :fill="C.darkGreen" />
      <circle cx="18" cy="34" r="8" :fill="C.paleGray" />
      <circle cx="34" cy="34" r="8" :fill="C.yellow" />
      <circle cx="26" cy="26" r="3" :fill="C.green" />
    </template>

    <template v-else-if="model === 'goldenButterfly'">
      <ellipse cx="15" cy="19" rx="11" ry="8.5" transform="rotate(-28 15 19)" :fill="C.yellow" />
      <ellipse cx="37" cy="19" rx="11" ry="8.5" transform="rotate(28 37 19)" :fill="C.yellow" />
      <ellipse cx="18" cy="34" rx="7.5" ry="6.5" transform="rotate(20 18 34)" :fill="C.paleYellow" />
      <ellipse cx="34" cy="34" rx="7.5" ry="6.5" transform="rotate(-20 34 34)" :fill="C.paleYellow" />
      <circle cx="13" cy="18" r="2.6" :fill="C.amber" />
      <circle cx="39" cy="18" r="2.6" :fill="C.amber" />
      <ellipse cx="26" cy="27" rx="2.4" ry="13" :fill="C.brown" />
      <path d="M25 15 Q21 7 17 6 M27 15 Q31 7 35 6" fill="none" :stroke="C.brown" stroke-width="1.3" stroke-linecap="round" />
    </template>

    <template v-else-if="model === 'dragon'">
      <path d="M4 44 C12 30 18 48 27 38 S36 22 40 20" fill="none" :stroke="C.orange" stroke-width="5" stroke-linecap="round" />
      <g :fill="C.darkOrange">
        <polygon points="11,35 12,29 15,34" /><polygon points="21,41 23,35 25,40" /><polygon points="31,30 34,25 35,30" />
      </g>
      <path d="M36 15 Q42 11 47 16 L49 22 Q43 25 38 23Z" :fill="C.orange" />
      <line x1="39" y1="14" x2="36" y2="7" :stroke="C.darkOrange" stroke-width="1.8" stroke-linecap="round" />
      <line x1="42" y1="13" x2="42" y2="6" :stroke="C.darkOrange" stroke-width="1.8" stroke-linecap="round" />
      <circle cx="42.5" cy="17" r="1.5" :fill="C.palestRed" />
      <path d="M49 21 L52 19 L50 23 L52 26 L48 24Z" :fill="C.yellow" />
    </template>

    <template v-else-if="model === 'sixtyForty'">
      <line x1="26" y1="10" x2="26" y2="44" stroke="currentColor" stroke-width="2" />
      <rect x="20" y="44" width="12" height="3" rx="1" fill="currentColor" />
      <line x1="9" y1="22" x2="43" y2="14" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      <circle cx="26" cy="18" r="2.2" fill="currentColor" />
      <path d="M9 22 L4 33 M9 22 L14 33 M43 14 L38 25 M43 14 L48 25" stroke="currentColor" stroke-width="1" />
      <path d="M2 33 Q9 40 16 33Z" :fill="C.blue" />
      <path d="M36 25 Q43 32 50 25Z" :fill="C.green" />
    </template>

    <template v-else-if="model === 'threeFund'">
      <line x1="26" y1="20" x2="26" y2="49" :stroke="C.purple" stroke-width="2.6" stroke-linecap="round" />
      <path d="M13 12 L13 16 Q13 24 26 24 Q39 24 39 16 L39 12" fill="none" :stroke="C.purple" stroke-width="2.6" />
      <line x1="26" y1="24" x2="26" y2="9" :stroke="C.purple" stroke-width="2.6" />
      <polygon points="13,3 9,12 17,12" :fill="C.blue" />
      <polygon points="26,1 22,10 30,10" :fill="C.paleBlue" />
      <polygon points="39,3 35,12 43,12" :fill="C.green" />
    </template>

    <template v-else-if="model === 'buffett'">
      <circle cx="23" cy="29" r="20" :fill="C.red" />
      <circle cx="23" cy="29" r="14" :fill="C.palestRed" />
      <circle cx="23" cy="29" r="8" :fill="C.red" />
      <circle cx="23" cy="29" r="3" :fill="C.palestRed" />
      <g class="text-ink" stroke="currentColor" stroke-linecap="round">
        <line x1="23" y1="29" x2="46" y2="6" stroke-width="2" />
        <path d="M46 6 L50 4 M46 6 L48 2 M43 9 L47 7 M43 9 L45 5" stroke-width="1.5" />
      </g>
    </template>

    <template v-else-if="model === 'swensen'">
      <path d="M14 24 V34 Q26 41 38 34 V24" :fill="C.darkPurple" />
      <polygon points="26,9 49,19 26,29 3,19" :fill="C.purple" />
      <circle cx="26" cy="19" r="1.8" :fill="C.yellow" />
      <path d="M26 19 L42 23 L42 35" fill="none" :stroke="C.yellow" stroke-width="1.6" />
      <rect x="39.5" y="35" width="5" height="7" rx="1" :fill="C.yellow" />
    </template>

    <template v-else-if="model === 'coffeehouse'">
      <path d="M18 6 Q15 10 18 14 Q21 18 18 22 M27 4 Q24 9 27 13 Q30 17 27 21" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
      <path d="M36 30 Q46 30 44 37 Q42 42 34 40" fill="none" :stroke="C.brown" stroke-width="2.6" />
      <path d="M9 26 H38 V36 Q38 45 29 45 H18 Q9 45 9 36Z" :fill="C.amber" />
      <ellipse cx="23.5" cy="26" rx="14.5" ry="3" :fill="C.coffee" />
      <ellipse cx="24" cy="48" rx="19" ry="2.6" :fill="C.paleGray" />
    </template>

    <template v-else-if="model === 'ivy'">
      <path d="M26 40 Q27 46 32 50" fill="none" :stroke="C.darkGreen" stroke-width="2.2" stroke-linecap="round" />
      <path
        d="M26 40 L17 34 L7 35 L12 26 L6 17 L16 17 L18 6 L26 13 L34 6 L36 17 L46 17 L40 26 L45 35 L35 34Z"
        :fill="C.leaf"
        :stroke="C.leaf"
        stroke-width="2"
        stroke-linejoin="round"
      />
      <path d="M26 38 V15 M26 29 L13 21 M26 29 L39 21 M26 34 L15 31 M26 34 L37 31" fill="none" :stroke="C.darkGreen" stroke-width="1.1" stroke-linecap="round" />
    </template>

    <template v-else-if="model === 'larry'">
      <path d="M26 4 L45 11 V24 Q45 39 26 48 Q7 39 7 24 V11Z" :fill="C.teal" />
      <path d="M26 36 V18 M19 25 L26 18 L33 25" fill="none" :stroke="C.paleTeal" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
    </template>
  </svg>
</template>

<script setup>
import { ILLUSTRATION as C } from '../../lib/palette.js'

defineProps({
  model: { type: String, required: true }, // clé du modèle (lib/models.js)
  label: { type: String, required: true }, // ce que montre le dessin, pour les lecteurs d'écran
  size: { type: Number, default: 40 },
})
</script>
