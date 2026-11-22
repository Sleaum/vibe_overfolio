<!--
  Choix entre 2 ou 3 options (ex. Compte | Courtier, Graphique | Tableau).
  Groupe de boutons à bascule : l'option active est annoncée par aria-pressed, pas seulement par sa couleur.
-->
<template>
  <div role="group" :aria-label="label" class="inline-flex rounded-lg border border-line-strong bg-wash p-0.5">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      :aria-pressed="option.value === modelValue"
      class="rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors duration-150"
      :class="option.value === modelValue ? 'bg-paper text-ink shadow-soft' : 'text-ink-2 hover:text-ink'"
      @click="emit('update:modelValue', option.value)"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<script setup>
defineProps({
  modelValue: { type: String, required: true },
  options: { type: Array, required: true }, // [{ value, label }]
  label: { type: String, required: true },
})

const emit = defineEmits(['update:modelValue'])
</script>
