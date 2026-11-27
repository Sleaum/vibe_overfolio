<!--
  Rubrique « Simulation » (/simulation) : menu des méthodes à gauche (lib/simulationMenu.js), page choisie à droite.
  /simulation ouvre Monte Carlo. Une méthode encore en préparation porte la mention « bientôt » et ouvre sa
  présentation (SimulationMethodPage.vue).
  Pas de bouton Brut / Net ici : Monte Carlo simule toujours le patrimoine net (actifs, et dettes qui se remboursent).
  Contenu aussi large que la rubrique Models. Menu, onglets sur mobile et largeurs : components/SectionLayout.vue.
-->
<template>
  <SectionLayout :title="MENU_NAMES.simulation" :items="items" :width="WIDTH" />
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import SectionLayout from '../components/SectionLayout.vue'
import { MENU_NAMES } from '../i18n/menu.js'
import { SIMULATION_MENU } from '../lib/simulationMenu.js'

const WIDTH = { column: 'lg:w-52', content: 'mx-auto w-full max-w-[88rem] px-5 sm:px-8' }

const { t } = useI18n()
const items = computed(() =>
  SIMULATION_MENU.map((item) => ({ ...item, badge: item.ready ? '' : t('simulationLayout.soon') })),
)
</script>
