<!--
  Page d'un graphique : /graphiques/<slug>. Le contenu vient de la spécification du graphique (lib/charts/*.js),
  le composant ChartView s'occupe de l'affichage, des états (chargement, erreur, aucune donnée) et des explications.
-->
<template>
  <div class="page-container py-12 sm:py-16">
    <nav aria-label="Fil d’Ariane" class="text-sm">
      <ol class="flex flex-wrap items-center gap-x-2 gap-y-1 text-ink-2">
        <li>
          <router-link to="/graphiques" class="rounded-md hover:text-ink hover:underline">Graphiques</router-link>
        </li>
        <li aria-hidden="true">/</li>
        <template v-if="parent">
          <li>
            <router-link :to="parent.to" class="rounded-md hover:text-ink hover:underline">{{ parent.title }}</router-link>
          </li>
          <li aria-hidden="true">/</li>
        </template>
        <li aria-current="page" class="text-ink">{{ spec ? spec.title : 'Graphique introuvable' }}</li>
      </ol>
    </nav>

    <div class="mt-8">
      <ChartView v-if="spec" :key="spec.slug" :spec="spec" />

      <div v-else class="max-w-2xl">
        <h1 class="text-h2 text-ink">Ce graphique n’existe pas</h1>
        <p class="mt-3 text-lead text-ink-2">
          L’adresse « {{ slug }} » ne correspond à aucun graphique. La page Graphiques les regroupe tous.
        </p>
        <AppButton to="/graphiques" class="mt-8">Voir tous les graphiques</AppButton>
      </div>
    </div>

    <!-- Graphique précédent et suivant, dans l'ordre de la page d'index -->
    <nav
      v-if="spec"
      aria-label="Autres graphiques"
      class="mt-16 flex flex-wrap items-start justify-between gap-6 border-t border-line pt-8"
    >
      <router-link v-if="around.previous" :to="linkTo(around.previous)" class="group max-w-xs rounded-md">
        <span class="block text-sm text-ink-2">Graphique précédent</span>
        <span class="mt-1 block font-semibold text-ink group-hover:underline">{{ around.previous.title }}</span>
      </router-link>
      <router-link v-if="around.next" :to="linkTo(around.next)" class="group ml-auto max-w-xs rounded-md text-right">
        <span class="block text-sm text-ink-2">Graphique suivant</span>
        <span class="mt-1 block font-semibold text-ink group-hover:underline">{{ around.next.title }}</span>
      </router-link>
    </nav>
  </div>
</template>

<script setup>
import { computed, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import AppButton from '../components/ui/AppButton.vue'
import ChartView from '../components/charts/ChartView.vue'
import { getChart, neighbours, parentPage } from '../lib/charts/index.js'

const route = useRoute()

const slug = computed(() => String(route.params.slug ?? ''))
const spec = computed(() => getChart(slug.value))
const parent = computed(() => (spec.value ? parentPage(spec.value.slug) : null))
const around = computed(() => (spec.value ? neighbours(spec.value.slug) : { previous: null, next: null }))

const linkTo = (chart) => ({ name: 'ChartPage', params: { slug: chart.slug } })

// Le titre de l'onglet du navigateur suit le graphique affiché
watchEffect(() => {
  document.title = spec.value ? `${spec.value.title} | Overfolio` : 'Graphique introuvable | Overfolio'
})
</script>
