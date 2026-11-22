<!--
  Bouton unique du site. Il devient un lien de page (prop `to`), un lien classique (`href`) ou un vrai <button>.
  Variantes : primary (action principale de l'écran), secondary, outline, ghost.
-->
<template>
  <component :is="tag" v-bind="linkAttrs" :class="classes">
    <slot />
  </component>
</template>

<script setup>
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

const props = defineProps({
  variant: { type: String, default: 'primary' },
  size: { type: String, default: 'md' },
  to: { type: [String, Object], default: null },
  href: { type: String, default: null },
  type: { type: String, default: 'button' },
  block: { type: Boolean, default: false },
})

const tag = computed(() => (props.to ? RouterLink : props.href ? 'a' : 'button'))

const linkAttrs = computed(() => {
  if (props.to) return { to: props.to }
  if (props.href) return { href: props.href }
  return { type: props.type }
})

const VARIANTS = {
  primary: 'bg-accent text-on-accent hover:bg-accent-hover',
  secondary: 'border border-line-strong bg-paper text-ink hover:bg-wash',
  outline: 'border border-accent bg-paper text-accent hover:bg-accent-wash',
  ghost: 'text-ink-2 hover:bg-wash hover:text-ink',
}

const SIZES = {
  md: 'h-11 px-5 text-[0.9375rem]',
  sm: 'h-9 px-3.5 text-sm',
}

const classes = computed(() => [
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold',
  'transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60',
  VARIANTS[props.variant] ?? VARIANTS.primary,
  SIZES[props.size] ?? SIZES.md,
  props.block ? 'w-full' : '',
])
</script>
