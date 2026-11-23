<!--
  Aperçu produit : la page GoogleSheet (données brutes) et une page Graphiques (répartition),
  avec des données fictives. Le graphique est le vrai composant du site.
-->
<template>
  <section aria-labelledby="titre-apercu" class="section-y bg-wash">
    <div class="page-container">
      <h2 id="titre-apercu" class="max-w-2xl text-h2 text-ink">{{ t('home.product.title') }}</h2>
      <p class="mt-4 max-w-2xl text-lead text-ink-2">
        {{ t('home.product.lead') }}
      </p>

      <div class="mt-14 grid grid-cols-12 gap-y-12 lg:gap-x-8">
        <!-- Page GoogleSheet -->
        <figure class="col-span-12 lg:col-span-7">
          <div class="overflow-hidden rounded-xl border border-line bg-paper shadow-soft" aria-hidden="true">
            <div class="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
              <span class="rounded-lg border border-line-strong px-3 py-1.5 text-sm text-ink">portfolio</span>
              <span class="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-on-accent">{{ t('home.product.refreshAll') }}</span>
            </div>
            <div class="overflow-x-auto">
              <table class="min-w-full border-collapse text-sm">
                <thead>
                  <tr class="bg-wash text-ink">
                    <th class="hidden whitespace-nowrap px-4 py-2.5 text-left font-semibold sm:table-cell">Date</th>
                    <th class="hidden whitespace-nowrap px-4 py-2.5 text-left font-semibold sm:table-cell">Asset</th>
                    <th class="whitespace-nowrap px-4 py-2.5 text-left font-semibold">Instrument</th>
                    <th class="px-4 py-2.5 text-right font-semibold sm:whitespace-nowrap">Assets Master Currency</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in rows" :key="row.instrument" class="border-t border-line text-ink-2">
                    <td class="hidden whitespace-nowrap px-4 py-2.5 sm:table-cell">{{ row.date }}</td>
                    <td class="hidden whitespace-nowrap px-4 py-2.5 sm:table-cell">{{ row.asset }}</td>
                    <td class="whitespace-nowrap px-4 py-2.5">{{ row.instrument }}</td>
                    <td class="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">{{ row.amount }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <figcaption class="mt-5 max-w-lg text-ink-2">
            <router-link to="/sheet" class="font-semibold text-accent underline underline-offset-4 hover:text-accent-hover">{{ t('home.product.sheetLink') }}</router-link
            >{{ t('home.product.sheetCaption') }}
          </figcaption>
        </figure>

        <!-- Page Graphiques -->
        <figure class="col-span-12 lg:col-span-5">
          <div class="rounded-xl border border-line bg-paper p-5 shadow-soft">
            <p class="text-sm font-medium text-ink">{{ t('home.product.donutTitle') }}</p>
            <BaseChart :option="donut" :height="230" :label="donutLabel" class="mt-2" />
            <ul class="mt-2 space-y-2 text-sm" aria-hidden="true">
              <li v-for="part in parts" :key="part.name" class="flex items-center gap-3">
                <span class="h-3 w-3 shrink-0 rounded-[3px]" :style="{ backgroundColor: part.color }"></span>
                <span class="flex-1 text-ink">{{ part.name }}</span>
                <span class="tabular-nums text-ink-2">{{ part.share }}</span>
              </li>
            </ul>
          </div>
          <figcaption class="mt-5 max-w-lg text-ink-2">
            <router-link to="/graphiques" class="font-semibold text-accent underline underline-offset-4 hover:text-accent-hover">{{ t('home.product.chartsLink') }}</router-link
            >{{ t('home.product.chartsCaption') }}
          </figcaption>
        </figure>
      </div>

      <p class="mt-10 text-sm text-ink-3">{{ t('home.product.samples') }}</p>
    </div>
  </section>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { donutOption, assetParts } from '../../lib/charts/assetDonut.js'
import { splitBy } from '../../lib/aggregate.js'
import { euro, formatCell, percent } from '../../lib/format.js'
import { sampleAssets, samplePortfolioRows } from '../../lib/sample.js'
import BaseChart from '../charts/BaseChart.vue'

const { t } = useI18n()

const rows = samplePortfolioRows().map((row) => ({ ...row, amount: formatCell(row.amount) }))

const { entries, total } = splitBy(sampleAssets(), 'name', 'value')
const rawParts = assetParts(entries, total)
const donut = donutOption(rawParts, total, undefined, euro) // données fictives : toujours en euros
const parts = [...rawParts]
  .sort((a, b) => b.value - a.value)
  .map((part) => ({ name: part.name, color: part.color, share: percent(part.share) }))
const donutLabel = t('home.product.donutA11y', { total: euro(total), count: rawParts.length })
</script>
