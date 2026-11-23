<template>
  <!-- Lien d'évitement : premier élément atteint au clavier, visible seulement au focus -->
  <a
    href="#contenu"
    class="sr-only z-50 rounded-lg bg-paper px-4 py-2 font-medium text-ink shadow-lift focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
    @click.prevent="focusMain"
  >
    {{ t('app.skipLink') }}
  </a>

  <Header />

  <!-- pt-16 : hauteur de l'en-tête fixe -->
  <main id="contenu" ref="main" tabindex="-1" class="min-h-[70vh] pt-16 focus:outline-none">
    <!-- Ici s'affiche la page en fonction de la route.
         :key : au changement de langue ou de devise d'affichage, la page est réaffichée, pour que tous ses textes,
         nombres, dates et graphiques soient refaits (y compris les calculs faits une seule fois), et ses tables
         relues dans la nouvelle devise (composables/useTable.js). -->
    <router-view :key="`${locale}|${displayCurrency}`" />
  </main>

  <Footer />

  <!-- Export PDF : progression (hors du PDF) -->
  <PdfProgress />
</template>

<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Header from './components/Header.vue'
import Footer from './components/Footer.vue'
import PdfProgress from './components/PdfProgress.vue'
import { displayCurrency } from './lib/displayCurrency.js'

const { t, locale } = useI18n()
const main = ref(null)

function focusMain() {
  main.value?.focus()
  main.value?.scrollIntoView?.()
}
</script>
