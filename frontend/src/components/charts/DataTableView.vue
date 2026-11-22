<!--
  Version « tableau » d'un graphique : mêmes chiffres, lisibles au lecteur d'écran, au clavier et à l'impression.
  Les colonnes de nombres sont alignées à droite ; la première colonne sert d'en-tête de ligne.
-->
<template>
  <div
    class="max-h-96 overflow-auto rounded-lg border border-line"
    tabindex="0"
    role="region"
    :aria-label="title"
  >
    <table class="min-w-full border-collapse text-sm">
      <caption class="sr-only">{{ title }}</caption>
      <thead>
        <tr>
          <th
            v-for="(column, c) in columns"
            :key="c"
            scope="col"
            class="sticky top-0 z-10 whitespace-nowrap border-b border-line bg-wash px-4 py-2.5 font-semibold text-ink"
            :class="numeric[c] ? 'text-right' : 'text-left'"
          >
            {{ column }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, r) in rows" :key="r" class="border-b border-line last:border-b-0">
          <template v-for="(cell, c) in row" :key="c">
            <th
              v-if="c === 0"
              scope="row"
              class="whitespace-nowrap px-4 py-2 font-medium text-ink"
              :class="numeric[c] ? 'text-right tabular-nums' : 'text-left'"
            >
              {{ cell }}
            </th>
            <td
              v-else
              class="whitespace-nowrap px-4 py-2 text-ink-2"
              :class="numeric[c] ? 'text-right tabular-nums' : 'text-left'"
            >
              {{ cell }}
            </td>
          </template>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
const title = computed(() => props.caption || t('chartUi.tableDefault'))

const props = defineProps({
  columns: { type: Array, required: true },
  rows: { type: Array, required: true }, // lignes de texte déjà formatées
  numeric: { type: Array, default: () => [] }, // un booléen par colonne : aligner à droite
  caption: { type: String, default: '' }, // vide : « Données du graphique » dans la langue active
})
</script>
