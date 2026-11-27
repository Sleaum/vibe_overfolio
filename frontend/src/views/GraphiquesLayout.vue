<!--
  Rubrique « Graphiques » (Charts) : menu à gauche (les entrées de MENU dans lib/charts/index.js), page choisie à droite.
  /graphiques ouvre la première entrée. Les adresses des pages ne changent pas : /portfolio-flow, /portfolio-snapshot,
  /strategie, /graphiques/<slug>. L'entrée active est calculée par menuKeyFor : un graphique ouvert seul allume
  l'entrée de son groupe (Flow, Envelopes…).
  En haut du menu, le bouton Brut / Net choisit les montants des graphiques de Flow, Snapshot et Envelopes.
  Sous le menu, les couleurs des types d'actifs, à choisir type par type (AssetColorSettings.vue).
  Menu, onglets sur mobile et largeurs : components/SectionLayout.vue.
-->
<template>
  <SectionLayout :title="MENU_NAMES.charts" :items="MENU" :active-key="activeKey" :width="WIDTH">
    <template #above-menu><AmountModeToggle /></template>
    <template #below-menu><AssetColorSettings /></template>
  </SectionLayout>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AmountModeToggle from '../components/AmountModeToggle.vue'
import SectionLayout from '../components/SectionLayout.vue'
import AssetColorSettings from '../components/charts/AssetColorSettings.vue'
import { MENU_NAMES } from '../i18n/menu.js'
import { MENU, menuKeyFor } from '../lib/charts/index.js'

const WIDTH = { column: 'lg:w-56', content: 'page-container' }

const route = useRoute()
const activeKey = computed(() => menuKeyFor(route))
</script>
