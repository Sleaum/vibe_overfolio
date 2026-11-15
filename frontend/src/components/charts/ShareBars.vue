<!--
  Liste de parts avec une barre fine : nom à gauche, part et montant à droite.
  Les valeurs sont écrites en toutes lettres, la barre n'est qu'un repère visuel (elle est cachée aux lecteurs d'écran).
  Largeur de la barre = part dans le total, pas dans le plus gros élément.
-->
<template>
  <ul class="space-y-2.5" :aria-label="label">
    <li v-for="item in items" :key="item.name">
      <div class="flex items-baseline justify-between gap-3 text-sm">
        <span class="min-w-0 break-words text-ink">{{ item.name }}</span>
        <span class="shrink-0 whitespace-nowrap tabular-nums text-ink-2">
          <span class="font-semibold text-ink">{{ percent(item.share) }}</span> · {{ euro(item.value) }}
        </span>
      </div>
      <div class="mt-1 h-1.5 overflow-hidden rounded-full bg-wash" aria-hidden="true">
        <div class="h-full rounded-full" :style="{ width: width(item.share), backgroundColor: color }"></div>
      </div>
    </li>
  </ul>
</template>

<script setup>
import { euro, percent } from '../../lib/format.js'

defineProps({
  items: { type: Array, required: true }, // [{ name, value, share }] share : fraction de 0 à 1
  color: { type: String, required: true },
  label: { type: String, default: '' },
})

// Au moins 2 % pour qu'une petite part reste visible
const width = (share) => `${Math.min(100, Math.max(2, share * 100)).toFixed(1)}%`
</script>
