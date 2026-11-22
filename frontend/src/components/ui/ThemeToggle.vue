<!--
  Bouton mode clair / sombre (en-tête) : lune en mode clair, soleil en mode sombre.
  L'état et la mémorisation du choix sont dans composables/useTheme.js.
-->
<template>
  <button
    type="button"
    class="inline-flex h-11 w-11 items-center justify-center rounded-lg text-ink-2 transition-colors hover:bg-wash hover:text-ink"
    :aria-label="isDark ? 'Passer en mode clair' : 'Passer en mode sombre'"
    :title="isDark ? 'Mode clair' : 'Mode sombre'"
    @click="toggle"
  >
    <!-- Soleil en mode sombre (pour revenir au clair), lune en mode clair -->
    <svg v-if="isDark" viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
    <svg v-else viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  </button>
</template>

<script setup>
import { useTheme } from '../../composables/useTheme.js'

const { isDark, toggle } = useTheme()
</script>
