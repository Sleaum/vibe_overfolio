<!--
  Page « Enveloppes » (/enveloppes) : tes enveloppes de placement (CTO, PEA, PER, PEE…), comme la page
  « Portfolio Stocks Enveloppe » de l'ancien rapport Data Studio. Graphiques : lib/charts/envelopes.js.
-->
<template>
  <div>
    <header class="max-w-3xl">
      <h1 class="text-h2 text-ink">{{ t('pages.envelopes') }}</h1>
      <p class="mt-3 text-lead text-ink-2">
        {{ t('envelopesPage.lead') }}
      </p>
    </header>

    <ChartGroup class="mt-10" :charts="ENVELOPE_CHARTS" />

    <i18n-t keypath="envelopesPage.footer" tag="p" scope="global" class="mt-12 max-w-2xl border-t border-line pt-6 text-ink-2">
      <template #strategy>
        <router-link to="/strategie" class="font-semibold text-accent underline underline-offset-4 hover:text-accent-hover">{{ t('pages.strategy') }}</router-link>
      </template>
    </i18n-t>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import ChartGroup from '../components/charts/ChartGroup.vue'
import { ENVELOPE_CHARTS } from '../lib/charts/index.js'

const { t } = useI18n()
</script>
