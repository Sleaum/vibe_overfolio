// true quand la personne a demandé de réduire les animations (réglage du système).
// La valeur est lue dès la création du composant : un graphique ne démarre pas une animation qu'on a refusée.

import { onBeforeUnmount, onMounted, ref } from 'vue'

const QUERY = '(prefers-reduced-motion: reduce)'

export function useReducedMotion() {
  const supported = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  const query = supported ? window.matchMedia(QUERY) : null
  const reduced = ref(Boolean(query?.matches))

  const update = () => {
    reduced.value = Boolean(query?.matches)
  }

  onMounted(() => query?.addEventListener?.('change', update))
  onBeforeUnmount(() => query?.removeEventListener?.('change', update))

  return reduced
}
