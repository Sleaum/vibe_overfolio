<!--
  Aperçu de la page d'accueil : la courbe du patrimoine et, glissée dessous, le morceau de feuille qui l'alimente.
  C'est le vrai graphique du site (même code), avec des données fictives clairement annoncées.
  La courbe se dessine une fois au chargement ; l'animation est coupée si la personne a demandé de les réduire.
-->
<template>
  <figure class="relative mx-auto w-full max-w-xl lg:mx-0 lg:max-w-none">
    <div class="rounded-xl border border-line bg-paper p-5 pb-16 shadow-lift sm:p-6 sm:pb-20">
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-sm text-ink-2">{{ t('home.preview.label') }}</p>
          <p class="mt-1 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">{{ headline }}</p>
          <p class="mt-1 text-sm text-ink-2">{{ evolution }}</p>
        </div>
        <span class="shrink-0 rounded-full border border-line bg-wash px-3 py-1 text-xs font-medium text-ink-2">
          {{ t('home.preview.sample') }}
        </span>
      </div>

      <div class="mt-5">
        <BaseChart :option="option" :height="240" :label="chartLabel" />
      </div>
    </div>

    <!-- Morceau de feuille : les deux dernières lignes sont celles de la fin de la courbe -->
    <div
      class="relative -mt-14 ml-4 w-[19rem] max-w-[calc(100%-2rem)] overflow-hidden rounded-xl border border-line-strong bg-paper shadow-lift sm:-mt-16 sm:ml-8"
      aria-hidden="true"
    >
      <table class="w-full border-collapse text-xs tabular-nums">
        <thead>
          <tr class="bg-wash text-ink-3">
            <th class="w-8 border-b border-r border-line py-1.5 font-normal"></th>
            <th v-for="letter in ['A', 'B', 'C']" :key="letter" class="border-b border-r border-line py-1.5 font-normal last:border-r-0">
              {{ letter }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, index) in sheetRows"
            :key="index"
            :class="row.selected ? 'bg-accent-wash font-medium text-ink' : index === 0 ? 'font-semibold text-ink' : 'text-ink-2'"
          >
            <td class="border-r border-t border-line bg-wash py-1.5 text-center text-ink-3">{{ index + 1 }}</td>
            <td
              v-for="(cell, c) in row.cells"
              :key="c"
              class="border-t border-line px-2.5 py-1.5"
              :class="[c > 0 ? 'text-right' : 'text-left', c < 2 ? 'border-r' : '']"
            >
              {{ cell }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <figcaption class="mt-5 text-sm text-ink-3">
      {{ t('home.preview.caption') }}
    </figcaption>
  </figure>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { buildEvolution } from '../../lib/aggregate.js'
import { evolutionOption } from '../../lib/charts/evolution.js'
import { euro, formatCell, formatDateNumeric, formatDateShort } from '../../lib/format.js'
import { sampleHistory } from '../../lib/sample.js'
import BaseChart from '../charts/BaseChart.vue'

const { t } = useI18n()

const points = buildEvolution(
  sampleHistory().rows,
  'Date',
  'Assets Master Currency',
  'Liabilities Master Currency',
)
const first = points[0]
const last = points[points.length - 1]

const option = evolutionOption(points, { preview: true })
const headline = euro(last.net)
const evolution = t('home.preview.since', { amount: euro(last.net - first.net), date: formatDateShort(first.date) })
const chartLabel = t('home.preview.a11y', { from: euro(first.net), to: euro(last.net) })

// Tête de feuille puis les deux derniers relevés (le dernier est sélectionné)
const sheetRows = [
  { cells: [t('chart.date'), t('chart.assets'), t('chart.liabilities')] },
  ...points.slice(-2).map((point, index, list) => ({
    cells: [formatDateNumeric(point.date), formatCell(Math.round(point.assets)), formatCell(Math.round(point.liabilities))],
    selected: index === list.length - 1,
  })),
]
</script>
