<!--
  Rubrique « Models » (/modeles) : menu à gauche, Target (/modeles/target, ta répartition cible et le plan pour
  l'atteindre) et Classic (/modeles, les portefeuilles modèles) ; page choisie à droite. Noms des entrées toujours en
  anglais (i18n/menu.js). En haut du menu, le bouton Brut / Net (le même choix que dans Charts, lib/amounts.js).
  Contenu plus large que les autres pages : le tableau de Classic a besoin de place à côté du menu.
  Menu, onglets sur mobile et largeurs : components/SectionLayout.vue.
-->
<template>
  <SectionLayout :title="MENU_NAMES.models" :items="MENU" :width="WIDTH">
    <template #above-menu><AmountModeToggle /></template>
  </SectionLayout>
</template>

<script setup>
import AmountModeToggle from '../components/AmountModeToggle.vue'
import SectionLayout from '../components/SectionLayout.vue'
import { MENU_NAMES } from '../i18n/menu.js'

const WIDTH = { column: 'lg:w-48', content: 'mx-auto w-full max-w-[88rem] px-5 sm:px-8' }

const MENU = [
  { key: 'target', to: '/modeles/target', title: MENU_NAMES.target },
  { key: 'classic', to: '/modeles', title: MENU_NAMES.classic },
]
</script>
