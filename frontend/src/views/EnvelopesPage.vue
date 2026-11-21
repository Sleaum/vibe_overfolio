<!--
  Page « Enveloppes » (/enveloppes) : tes enveloppes de placement (CTO, PEA, PER, PEE…), comme la page
  « Portfolio Stocks Enveloppe » de l'ancien rapport Data Studio. Graphiques : lib/charts/envelopes.js.
-->
<template>
  <div>
    <header class="max-w-3xl">
      <h1 class="text-h2 text-ink">Enveloppes</h1>
      <p class="mt-3 text-lead text-ink-2">
        Tes enveloppes de placement : ce que chacune contient, comment elles évoluent, et leur répartition entre ETF,
        actions et liquidités, puis par zone. Les comptes qui ne contiennent ni actions, ni ETF, ni fonds n’y figurent pas.
      </p>
    </header>

    <ChartGroup class="mt-10" :charts="ENVELOPE_CHARTS" />

    <p class="mt-12 max-w-2xl border-t border-line pt-6 text-ink-2">
      Pour le détail de tes actions par secteur, moat ou note, ouvre
      <router-link to="/strategie" class="font-semibold text-accent underline underline-offset-4 hover:text-accent-hover">
        Stratégie CTO</router-link
      >.
    </p>
  </div>
</template>

<script setup>
import ChartGroup from '../components/charts/ChartGroup.vue'
import { ENVELOPE_CHARTS } from '../lib/charts/index.js'
</script>
