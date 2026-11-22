<!--
  Page d'un graphique : /graphiques/<slug>. Le contenu vient de la spécification du graphique (lib/charts/*.js),
  le composant ChartView s'occupe de l'affichage, des états (chargement, erreur, aucune donnée) et des explications.
-->
<template>
  <div>
    <!-- Fil d'Ariane seulement pour un graphique qui appartient à une page (Portfolio Flow) : le menu de gauche suffit sinon -->
    <nav v-if="parent" :aria-label="t('chartPage.breadcrumb')" class="mb-8 text-sm">
      <ol class="flex flex-wrap items-center gap-x-2 gap-y-1 text-ink-2">
        <li>
          <router-link :to="parent.to" class="rounded-md hover:text-ink hover:underline">{{ parent.title }}</router-link>
        </li>
        <li aria-hidden="true">/</li>
        <li aria-current="page" class="text-ink">{{ spec.title }}</li>
      </ol>
    </nav>

    <div>
      <ChartView v-if="spec" :key="spec.slug" :spec="spec" />

      <div v-else class="max-w-2xl">
        <h1 class="text-h2 text-ink">{{ t('chartPage.notFoundTitle') }}</h1>
        <p class="mt-3 text-lead text-ink-2">
          {{ t('chartPage.notFoundText', { slug }) }}
        </p>
        <AppButton to="/graphiques" class="mt-8">{{ t('chartPage.allCharts') }}</AppButton>
      </div>
    </div>

    <!-- Graphique précédent et suivant, dans l'ordre de la page d'index -->
    <nav
      v-if="spec"
      :aria-label="t('chartPage.otherCharts')"
      class="mt-16 flex flex-wrap items-start justify-between gap-6 border-t border-line pt-8"
    >
      <router-link v-if="around.previous" :to="linkTo(around.previous)" class="group max-w-xs rounded-md">
        <span class="block text-sm text-ink-2">{{ t('chartPage.previous') }}</span>
        <span class="mt-1 block font-semibold text-ink group-hover:underline">{{ around.previous.title }}</span>
      </router-link>
      <router-link v-if="around.next" :to="linkTo(around.next)" class="group ml-auto max-w-xs rounded-md text-right">
        <span class="block text-sm text-ink-2">{{ t('chartPage.next') }}</span>
        <span class="mt-1 block font-semibold text-ink group-hover:underline">{{ around.next.title }}</span>
      </router-link>
    </nav>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { computed, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import AppButton from '../components/ui/AppButton.vue'
import ChartView from '../components/charts/ChartView.vue'
import { getChart, neighbours, parentPage } from '../lib/charts/index.js'

const { t } = useI18n()

const route = useRoute()

const slug = computed(() => String(route.params.slug ?? ''))
const spec = computed(() => getChart(slug.value))
const parent = computed(() => (spec.value ? parentPage(spec.value.slug) : null))
const around = computed(() => (spec.value ? neighbours(spec.value.slug) : { previous: null, next: null }))

const linkTo = (chart) => ({ name: 'ChartPage', params: { slug: chart.slug } })

// Le titre de l'onglet du navigateur suit le graphique affiché
watchEffect(() => {
  document.title = `${spec.value ? spec.value.title : t('chartPage.notFoundDocTitle')} | Overfolio`
})
</script>
