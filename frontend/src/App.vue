<template>
  <!-- Lien d'évitement : premier élément atteint au clavier, visible seulement au focus -->
  <a
    href="#contenu"
    class="sr-only z-50 rounded-lg bg-paper px-4 py-2 font-medium text-ink shadow-lift focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
    @click.prevent="focusMain"
  >
    Aller au contenu
  </a>

  <Header />

  <!-- pt-16 : hauteur de l'en-tête fixe -->
  <main id="contenu" ref="main" tabindex="-1" class="min-h-[70vh] pt-16 focus:outline-none">
    <!-- Ici s'affiche la page en fonction de la route -->
    <router-view />
  </main>

  <Footer />
</template>

<script setup>
import { ref } from 'vue'
import Header from './components/Header.vue'
import Footer from './components/Footer.vue'

const main = ref(null)

function focusMain() {
  main.value?.focus()
  main.value?.scrollIntoView?.()
}
</script>
