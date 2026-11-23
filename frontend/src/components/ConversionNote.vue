<!--
  Phrase sous le titre d'une page : montants de la table convertis par le serveur (devise d'affichage de l'en-tête,
  ou feuille dans une autre devise que l'euro), en rouge si des lignes sont écartées faute de taux de la BCE.
  Rien si les montants sont ceux de la feuille. Texte : conversionNote() de lib/amounts.js.
-->
<template>
  <p v-if="text" class="text-sm" :class="missing ? 'text-danger' : 'text-ink-3'" :role="missing ? 'status' : undefined" :data-testid="testid">
    {{ text }}
  </p>
</template>

<script setup>
import { computed } from 'vue'
import { conversionNote } from '../lib/amounts.js'

const props = defineProps({
  table: { type: Object, default: null }, // réponse de GET /api/data/<onglet>/
  testid: { type: String, default: 'conversion-note' },
})

const text = computed(() => conversionNote(props.table))
const missing = computed(() => Boolean(props.table?.unconverted_rows))
</script>
