<!--
  Page « Graphiques » (/graphiques, ancienne adresse /echart conservée) : une carte par page de graphiques.
  Les cartes viennent de GALLERY dans lib/charts/index.js : en ajouter une là-bas l'ajoute ici.
-->
<template>
  <div class="page-container py-12 sm:py-16">
    <header class="max-w-3xl">
      <h1 class="text-h2 text-ink">Graphiques</h1>
      <p class="mt-3 text-lead text-ink-2">
        {{ countLabel }} pour lire ta feuille. Chacune explique ce que tu vois et d’où viennent les chiffres.
      </p>
    </header>

    <ul class="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
      <li v-for="item in GALLERY" :key="item.key">
        <router-link
          :to="item.to"
          class="group flex h-full flex-col rounded-xl border border-line bg-white shadow-soft transition-colors hover:border-line-strong"
        >
          <div class="rounded-t-xl border-b border-line bg-wash px-6 py-5">
            <ChartThumb :kind="item.thumb" />
          </div>
          <div class="flex-1 p-6">
            <h2 class="text-h3 text-ink group-hover:underline">{{ item.title }}</h2>
            <p class="mt-2 text-ink-2">{{ item.summary }}</p>
          </div>
        </router-link>
      </li>
    </ul>

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
import { GALLERY } from '../lib/charts/index.js'

const countLabel = `${GALLERY.length} pages`
</script>
