<!--
  Page « Portfolio Flow » (/portfolio-flow) : l'historique du patrimoine mois par mois, en six graphiques sur une seule page.
  Les graphiques viennent de lib/charts (FLOW_CHARTS). Le choix d'une année (?annee=2026 dans l'adresse) ne garde que
  les relevés et les mouvements de cette année-là, comme les pages 2024, 2025 et 2026 de l'ancien rapport Data Studio.
-->
<template>
  <div>
    <header class="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
      <div class="max-w-3xl">
        <h1 class="text-h2 text-ink">{{ t('pages.flow') }}{{ year ? ` ${year}` : '' }}</h1>
        <p class="mt-3 text-lead text-ink-2">
          {{ t('flowPage.lead') }}
        </p>
      </div>
      <div v-if="years.length > 1">
        <label for="annee" class="block text-sm font-medium text-ink-2">{{ t('flowPage.period') }}</label>
        <select
          id="annee"
          :value="year"
          class="mt-1 rounded-lg border border-line-strong bg-paper px-3 py-2 text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          @change="setYear($event.target.value)"
        >
          <option value="">{{ t('flowPage.allYears') }}</option>
          <option v-for="option in years" :key="option" :value="option">{{ option }}</option>
        </select>
      </div>
    </header>

    <p v-if="year" class="mt-4 max-w-3xl text-sm text-ink-2" aria-live="polite">
      {{ t('flowPage.yearNote', { year }) }}
    </p>

    <ChartGroup ref="group" class="mt-10" :charts="FLOW_CHARTS" :transform="year ? onlyYear : null" />

    <i18n-t keypath="flowPage.footer" tag="p" scope="global" class="mt-12 max-w-2xl border-t border-line pt-6 text-ink-2">
      <template #sheet>
        <router-link to="/sheet" class="font-semibold text-accent underline underline-offset-4 hover:text-accent-hover">GoogleSheet</router-link>
      </template>
      <template #snapshot>
        <router-link to="/portfolio-snapshot" class="font-semibold text-accent underline underline-offset-4 hover:text-accent-hover">{{ t('pages.snapshot') }}</router-link>
      </template>
    </i18n-t>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ChartGroup from '../components/charts/ChartGroup.vue'
import { filterByYear, yearsOf } from '../lib/charts/flowData.js'
import { FLOW_CHARTS } from '../lib/charts/index.js'

const { t } = useI18n()

const route = useRoute()
const router = useRouter()
const group = ref(null)

// Années proposées : celles des relevés de history (la table est déjà chargée par les graphiques)
const years = computed(() => yearsOf(group.value?.tables?.history?.data?.value))
const year = computed(() => {
  const asked = String(route.query.annee ?? '')
  return /^\d{4}$/.test(asked) ? asked : ''
})

const setYear = (value) => router.replace({ query: { ...route.query, annee: value || undefined } })
const onlyYear = (table) => filterByYear(table, year.value)
</script>
