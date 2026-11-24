<!--
  Présentation d'une méthode de la rubrique Simulation encore en préparation (route avec meta.method :
  backtest, stress, scenarios, parametric, bootstrap, regimes, macro ; voir lib/simulationMenu.js).
  Ce que fait la méthode, ce que la page montrera, et les données qu'elle utilisera. Textes : rubrique simMethods.
-->
<template>
  <div>
    <header class="max-w-3xl">
      <p class="text-sm font-semibold text-ink-3">{{ MENU_NAMES[method] }}</p>
      <h1 class="mt-1 text-h2 text-ink">{{ t(`simMethods.${method}.title`) }}</h1>
      <p class="mt-3 text-lead text-ink-2">{{ t(`simMethods.${method}.lead`) }}</p>
    </header>

    <section class="mt-10 max-w-3xl rounded-xl border border-line bg-paper p-5 shadow-soft sm:p-6" aria-labelledby="titre-bientot">
      <div class="flex flex-wrap items-center gap-3">
        <h2 id="titre-bientot" class="text-h3 text-ink">{{ t('simMethods.planned') }}</h2>
        <span class="rounded-md border border-line bg-wash px-2 py-0.5 text-xs text-ink-3">{{ t('simulationLayout.soon') }}</span>
      </div>
      <ul class="mt-4 list-disc space-y-2 pl-5 text-ink-2">
        <li v-for="item in tList(`simMethods.${method}.will`)" :key="item">{{ item }}</li>
      </ul>
      <p class="mt-5 border-t border-line pt-4 text-sm text-ink-3">{{ t('simMethods.shared') }}</p>
    </section>

    <p class="mt-6 text-sm text-ink-2">
      <router-link to="/simulation" class="font-semibold text-accent underline-offset-4 hover:underline">{{ t('simMethods.backToMonteCarlo') }}</router-link>
    </p>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { MENU_NAMES } from '../i18n/menu.js'
import { tList } from '../i18n/index.js'

const { t } = useI18n()
const route = useRoute()
const method = computed(() => route.meta.method)
</script>
