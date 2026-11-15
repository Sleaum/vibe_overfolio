<!--
  Page « Graphiques » (/graphiques, ancienne adresse /echart conservée) : une carte par graphique.
  La liste vient de lib/charts/index.js : ajouter un graphique là-bas l'ajoute ici.
-->
<template>
  <div class="page-container py-12 sm:py-16">
    <header class="max-w-3xl">
      <h1 class="text-h2 text-ink">Graphiques</h1>
      <p class="mt-3 text-lead text-ink-2">
        {{ countLabel }} pour lire ta feuille. Chaque page explique ce que tu vois et d’où viennent les chiffres.
      </p>
    </header>

    <section
      v-for="group in groups"
      :key="group.id"
      :aria-labelledby="`groupe-${group.id}`"
      class="mt-14"
    >
      <h2 :id="`groupe-${group.id}`" class="text-h3 text-ink">{{ group.title }}</h2>

      <ul class="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <li v-for="chart in group.charts" :key="chart.slug">
          <router-link
            :to="{ name: 'ChartPage', params: { slug: chart.slug } }"
            class="group flex h-full flex-col rounded-xl border border-line bg-white shadow-soft transition-colors hover:border-line-strong"
          >
            <div class="rounded-t-xl border-b border-line bg-wash px-6 py-5">
              <ChartThumb :kind="chart.thumb" />
            </div>
            <div class="flex-1 p-6">
              <h3 class="text-h3 text-ink group-hover:underline">{{ chart.title }}</h3>
              <p class="mt-2 text-ink-2">{{ chart.summary }}</p>
            </div>
          </router-link>
        </li>
      </ul>
    </section>

    <p class="mt-16 max-w-2xl border-t border-line pt-6 text-ink-2">
      Les graphiques lisent la base de données. Pour la mettre à jour depuis ta feuille, utilise le bouton Actualiser de
      la page
      <router-link to="/sheet" class="font-semibold text-accent underline underline-offset-4 hover:text-accent-hover">
        GoogleSheet</router-link
      >.
    </p>
  </div>
</template>

<script setup>
import ChartThumb from '../components/charts/ChartThumb.vue'
import { CHARTS, CHART_GROUPS, chartsOfGroup } from '../lib/charts/index.js'

const groups = CHART_GROUPS.map((group) => ({ ...group, charts: chartsOfGroup(group.id) })).filter(
  (group) => group.charts.length > 0,
)

const countLabel = `${CHARTS.length} graphiques`
</script>
