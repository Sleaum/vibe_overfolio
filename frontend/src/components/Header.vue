<!--
  En-tête fixe : à gauche, logo-texte (vers la page de présentation) et date des positions de la table portfolio
  (lib/portfolioDate.js) ; menu à droite.
  À droite du menu : devise d'affichage de Charts et Simulation (CurrencySelect.vue, lib/displayCurrency.js), bouton
  PDF (tout le site en un PDF, lib/pdfExport.js), compte (connexion avec Google, AccountMenu.vue), langue, bouton
  soleil/lune du mode sombre.
  Mobile : bouton burger accessible (clavier, aria-expanded, libellé qui change, Échap, fermeture au clic extérieur).
  Le menu de l'ordinateur (GoogleSheet, Charts, Simulation, Models) n'apparaît qu'à partir de 1024 px ; en dessous, il est
  dans le menu burger, avec la devise. Sous 640 px, le compte passe aussi dans le menu burger. Le bouton PDF et Connexion
  ne gardent que leur icône sous 640 px et entre 1024 et 1280 px (place du menu) ; la date des positions est cachée sous 400 px.
-->
<template>
  <header
    ref="root"
    class="fixed inset-x-0 top-0 z-40 border-b border-line bg-paper/95 backdrop-blur supports-[backdrop-filter]:bg-paper/85"
  >
    <div class="page-container flex h-16 items-center justify-between">
      <div class="flex min-w-0 items-center gap-1 sm:gap-2">
        <router-link
          to="/"
          class="shrink-0 rounded-md text-2xl font-extrabold tracking-tight text-ink"
          :aria-label="t('app.home')"
        >
          Overfolio
        </router-link>
        <!-- Date des positions (table portfolio, lib/portfolioDate.js) ; rien tant qu'elle n'est pas connue -->
        <time
          v-if="portfolioDate"
          :datetime="portfolioDate"
          :title="t('nav.portfolioDate')"
          class="ml-1 hidden whitespace-nowrap text-sm tabular-nums text-ink-2 min-[400px]:inline sm:ml-2"
          data-testid="header-portfolio-date"
        >
          <span class="sr-only">{{ t('nav.portfolioDate') }}</span> {{ formatDateShort(portfolioDate) }}
        </time>
      </div>

      <!-- Menu ordinateur -->
      <nav :aria-label="t('nav.main')" class="hidden items-center lg:ml-auto lg:flex">
        <ul class="flex items-center gap-1">
          <li v-for="link in LINKS" :key="link.to">
            <router-link
              :to="link.to"
              :class="[linkClasses, isActive(link) ? '!text-ink after:!bg-accent' : '']"
              :aria-current="isActive(link) ? 'page' : undefined"
            >
              {{ link.label }}
            </router-link>
          </li>
        </ul>
      </nav>

      <div class="flex items-center gap-1 lg:ml-2">
        <!-- Devise d'affichage (à la suite du menu Models), PDF de tout le site (une page web = une page PDF),
             puis compte, langue, mode clair / sombre -->
        <CurrencySelect class="hidden lg:inline-flex" />
        <button
          type="button"
          class="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold text-ink-2 hover:bg-wash hover:text-ink disabled:opacity-50"
          :title="t('nav.pdfTitle')"
          :aria-label="t('nav.pdfTitle')"
          :disabled="pdfExport.running"
          :aria-busy="pdfExport.running"
          @click="startPdf"
        >
          <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
            <path d="M14 3v5h5M12 18v-6M9 15l3 3 3-3" />
          </svg>
          <span class="hidden sm:inline lg:hidden xl:inline">{{ t('nav.pdf') }}</span>
        </button>
        <AccountMenu class="hidden sm:block" />
        <LanguageSelect />
        <ThemeToggle />

        <!-- Bouton burger (mobile) -->
        <button
          ref="burger"
          type="button"
          class="-mr-2 inline-flex h-11 w-11 items-center justify-center rounded-lg text-ink hover:bg-wash lg:hidden"
          aria-controls="menu-mobile"
          :aria-expanded="open"
          :aria-label="open ? t('nav.closeMenu') : t('nav.openMenu')"
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
    </div>

    <!-- Menu mobile -->
    <nav
      v-show="open"
      id="menu-mobile"
      :aria-label="t('nav.mainMobile')"
      class="border-t border-line bg-paper lg:hidden"
    >
      <ul class="page-container space-y-1 py-3">
        <li v-for="link in LINKS" :key="link.to">
          <router-link
            :to="link.to"
            class="flex h-12 items-center rounded-lg px-3 text-base font-medium text-ink-2 hover:bg-wash hover:text-ink"
            :class="isActive(link) ? 'bg-accent-wash !text-accent' : ''"
            :aria-current="isActive(link) ? 'page' : undefined"
          >
            {{ link.label }}
          </router-link>
        </li>
        <!-- Devise d'affichage : dans l'en-tête à partir de 1024 px, ici en dessous -->
        <li>
          <CurrencySelect variant="mobile" />
        </li>
        <!-- Compte : dans l'en-tête à partir de 640 px, ici en dessous -->
        <li class="sm:hidden">
          <AccountMenu variant="mobile" />
        </li>
      </ul>
    </nav>
  </header>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { MENU_NAMES } from '../i18n/menu.js'
import AccountMenu from './AccountMenu.vue'
import LanguageSelect from './ui/LanguageSelect.vue'
import CurrencySelect from './ui/CurrencySelect.vue'
import ThemeToggle from './ui/ThemeToggle.vue'
import { exportSite, pdfExport } from '../lib/pdfExport.js'
import { formatDateShort } from '../lib/format.js'
import { loadPortfolioDate, portfolioDate } from '../lib/portfolioDate.js'

const { t } = useI18n()

// Noms des menus : toujours en anglais (i18n/menu.js), non traduits
// Les chemins existants restent valides : /sheet (alias /source) et /graphiques (alias /echart)
// `under` : adresses qui font partie de la rubrique (la page d'un graphique est sous /graphiques/…)
const LINKS = [
  { label: MENU_NAMES.sheet, to: '/sheet', under: ['/sheet', '/source'] },
  {
    label: MENU_NAMES.charts,
    to: '/graphiques',
    under: ['/graphiques', '/echart', '/portfolio-flow', '/portfolio-snapshot', '/strategie', '/enveloppes', '/volatilite'],
  },
  { label: MENU_NAMES.simulation, to: '/simulation', under: ['/simulation'] },
  { label: MENU_NAMES.models, to: '/modeles', under: ['/modeles'] },
]

const isActive = (link) => link.under.some((base) => route.path === base || route.path.startsWith(`${base}/`))

// Lien actif : trait d'accent sous le texte, collé au bord bas de l'en-tête
const linkClasses =
  'relative block rounded-md px-3 py-2 text-[0.9375rem] font-medium text-ink-2 transition-colors hover:text-ink ' +
  'after:absolute after:inset-x-3 after:-bottom-[11px] after:h-0.5 after:rounded-full after:bg-transparent'

const route = useRoute()
const router = useRouter()

// Bouton PDF : ferme le menu mobile (il serait photographié), puis parcourt tout le site
function startPdf() {
  open.value = false
  exportSite(router)
}
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
  loadPortfolioDate()
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
