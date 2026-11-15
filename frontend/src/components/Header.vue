<!--
  En-tête fixe : logo-texte à gauche (vers la page de présentation), menu à droite.
  Mobile : bouton burger accessible (clavier, aria-expanded, libellé qui change, Échap, fermeture au clic extérieur).
  "S'abonner" mène à la section Tarifs de la page de présentation.
-->
<template>
  <header
    ref="root"
    class="fixed inset-x-0 top-0 z-40 border-b border-line bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85"
  >
    <div class="page-container flex h-16 items-center justify-between">
      <router-link
        to="/"
        class="rounded-md text-xl font-extrabold tracking-tight text-ink"
        aria-label="Overfolio, retour à la page d’accueil"
      >
        Overfolio
      </router-link>

      <!-- Menu ordinateur -->
      <nav aria-label="Navigation principale" class="hidden items-center md:flex">
        <ul class="flex items-center gap-1">
          <li v-for="link in LINKS" :key="link.label">
            <router-link
              :to="link.to"
              :class="[linkClasses, isActive(link) ? '!text-ink after:!bg-accent' : '']"
              :aria-current="isActive(link) ? 'page' : undefined"
            >
              {{ link.label }}
            </router-link>
          </li>
        </ul>
        <div class="ml-5 flex items-center gap-2">
          <AppButton to="/newpage" variant="ghost" size="sm">Connexion</AppButton>
          <AppButton :to="{ name: 'Home', hash: '#tarifs' }" variant="outline" size="sm">S’abonner</AppButton>
        </div>
      </nav>

      <!-- Bouton burger (mobile) -->
      <button
        ref="burger"
        type="button"
        class="-mr-2 inline-flex h-11 w-11 items-center justify-center rounded-lg text-ink hover:bg-wash md:hidden"
        aria-controls="menu-mobile"
        :aria-expanded="open"
        :aria-label="open ? 'Fermer le menu' : 'Ouvrir le menu'"
        @click="open = !open"
      >
        <svg v-if="!open" viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
        <svg v-else viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>

    <!-- Menu mobile -->
    <nav
      v-show="open"
      id="menu-mobile"
      aria-label="Navigation principale (mobile)"
      class="border-t border-line bg-white md:hidden"
    >
      <ul class="page-container space-y-1 py-3">
        <li v-for="link in LINKS" :key="link.label">
          <router-link
            :to="link.to"
            class="flex h-12 items-center rounded-lg px-3 text-base font-medium text-ink-2 hover:bg-wash hover:text-ink"
            :class="isActive(link) ? 'bg-accent-wash !text-accent' : ''"
            :aria-current="isActive(link) ? 'page' : undefined"
          >
            {{ link.label }}
          </router-link>
        </li>
      </ul>
      <div class="page-container flex flex-col gap-2 pb-5">
        <AppButton to="/newpage" variant="secondary" block>Connexion</AppButton>
        <AppButton :to="{ name: 'Home', hash: '#tarifs' }" variant="outline" block>S’abonner</AppButton>
      </div>
    </nav>
  </header>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppButton from './ui/AppButton.vue'

// Les chemins existants restent valides : /sheet (alias /source) et /graphiques (alias /echart)
// `under` : adresses qui font partie de la rubrique (la page d'un graphique est sous /graphiques/…)
const LINKS = [
  { label: 'GoogleSheet', to: '/sheet', under: ['/sheet', '/source'] },
  {
    label: 'Graphiques',
    to: '/graphiques',
    under: ['/graphiques', '/echart', '/portfolio-flow', '/portfolio-snapshot', '/strategie'],
  },
]

const isActive = (link) => link.under.some((base) => route.path === base || route.path.startsWith(`${base}/`))

// Lien actif : trait d'accent sous le texte, collé au bord bas de l'en-tête
const linkClasses =
  'relative block rounded-md px-3 py-2 text-[0.9375rem] font-medium text-ink-2 transition-colors hover:text-ink ' +
  'after:absolute after:inset-x-3 after:-bottom-[11px] after:h-0.5 after:rounded-full after:bg-transparent'

const route = useRoute()
const open = ref(false)
const root = ref(null)
const burger = ref(null)

function close(restoreFocus = false) {
  if (!open.value) return
  open.value = false
  if (restoreFocus) burger.value?.focus()
}

function onKeydown(event) {
  if (event.key === 'Escape') close(true)
}

function onPointerDown(event) {
  if (open.value && root.value && !root.value.contains(event.target)) close()
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  document.addEventListener('pointerdown', onPointerDown)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  document.removeEventListener('pointerdown', onPointerDown)
})

// Après un clic sur un lien, la page change : le menu se referme
watch(
  () => route.fullPath,
  () => close(),
)
</script>
