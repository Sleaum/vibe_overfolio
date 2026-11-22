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
         :key="locale" : au changement de langue, la page est réaffichée, pour que tous ses textes, nombres, dates
         et graphiques soient refaits dans la nouvelle langue (y compris les calculs faits une seule fois). -->
    <router-view :key="locale" />
  </main>

  <Footer />
</template>

<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Header from './components/Header.vue'
import Footer from './components/Footer.vue'

const { t, locale } = useI18n()
const main = ref(null)

function focusMain() {
  main.value?.focus()
  main.value?.scrollIntoView?.()
}
</script>
