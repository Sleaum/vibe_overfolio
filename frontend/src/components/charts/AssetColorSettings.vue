<!--
  Menu de Charts : couleurs des types d'actifs, choisies type par type dans les teintes de lib/palette.js (ASSET_SWATCHES).
  Liste : les types habituels (ASSET_ORDER) puis ceux trouvés dans la table `portfolio`.
  Un clic sur un type ouvre ses teintes ; si la teinte est déjà prise, les deux types échangent leurs couleurs.
  Le choix est gardé par le navigateur (lib/preferences.js) et tous les graphiques se recalculent aussitôt.
  Sur grand écran le bloc est ouvert ; sur petit écran il est replié sous les onglets.
-->
<template>
  <details class="mt-6 lg:px-3" :open="wide">
    <summary class="cursor-pointer select-none text-xs font-semibold uppercase tracking-wide text-ink-3 hover:text-ink">
      {{ t('assetColors.title') }}
    </summary>

    <ul class="mt-3 space-y-0.5">
      <li v-for="item in items" :key="item.name">
        <button
          type="button"
          class="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm transition-colors"
          :class="editing === item.name ? 'bg-wash text-ink' : 'text-ink-2 hover:bg-wash hover:text-ink'"
          :aria-expanded="editing === item.name"
          @click="editing = editing === item.name ? null : item.name"
        >
          <span class="h-4 w-4 shrink-0 rounded-full" :style="{ backgroundColor: item.color }" aria-hidden="true" />
          <span class="truncate">{{ item.label }}</span>
        </button>

        <div
          v-if="editing === item.name"
          role="group"
          :aria-label="t('assetColors.choose', { name: item.label })"
          class="mb-2 mt-1 grid w-max grid-cols-8 gap-1.5 px-2 py-1"
        >
          <button
            v-for="swatch in ASSET_SWATCHES"
            :key="swatch.color"
            type="button"
            class="h-5 w-5 rounded-full transition-transform hover:scale-110"
            :class="swatch.color === item.color ? 'ring-2 ring-ink ring-offset-2 ring-offset-paper' : ''"
            :style="{ backgroundColor: swatch.color }"
            :aria-label="swatchName(swatch)"
            :title="swatchName(swatch)"
            :aria-pressed="swatch.color === item.color"
            @click="choose(item.name, swatch.color)"
          />
        </div>
      </li>
    </ul>

    <p class="mt-3 max-w-xs text-xs text-ink-3">{{ t('assetColors.help') }}</p>
    <button
      v-if="hasChoices"
      type="button"
      class="mt-2 rounded-md text-xs font-medium text-ink-2 underline hover:text-ink"
      @click="reset"
    >
      {{ t('assetColors.reset') }}
    </button>
  </details>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { computed, ref } from 'vue'
import { useTable } from '../../composables/useTable.js'
import { findColumn } from '../../lib/aggregate.js'
import {
  ASSET_ORDER,
  ASSET_SWATCHES,
  assetColorChoices,
  assignAssetColors,
  resetAssetColors,
  setAssetColor,
} from '../../lib/palette.js'

const { t } = useI18n()

// Ouvert sur grand écran (menu en colonne), replié sur petit écran (menu en onglets)
const wide = typeof window !== 'undefined' && window.matchMedia?.('(min-width: 1024px)').matches

const portfolio = useTable('portfolio')

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1)

/** Types à lister : les types habituels, puis ceux de la feuille (sans doublon, casse ignorée). */
const names = computed(() => {
  const seen = new Set(ASSET_ORDER)
  const list = [...ASSET_ORDER]
  const table = portfolio.data.value
  const column = table ? findColumn(table.columns ?? [], ['Asset']) : null
  if (column) {
    const found = new Set()
    for (const row of table.rows ?? []) {
      const name = String(row[column] ?? '').trim()
      if (name && !seen.has(name.toLowerCase())) found.add(name)
    }
    for (const name of [...found].sort((a, b) => a.localeCompare(b))) {
      if (seen.has(name.toLowerCase())) continue
      seen.add(name.toLowerCase())
      list.push(name)
    }
  }
  return list
})

const items = computed(() => {
  const { colors } = assignAssetColors(names.value)
  return names.value.map((name) => ({ name, label: capitalize(name), color: colors.get(name).color }))
})

const hasChoices = computed(() => Object.keys(assetColorChoices.value).length > 0)

const editing = ref(null)

function choose(name, color) {
  setAssetColor(name, color, names.value)
}

function reset() {
  resetAssetColors()
  editing.value = null
}

function swatchName(swatch) {
  const hue = t(`assetColors.swatch.${swatch.hue}`)
  return swatch.light ? t('assetColors.light', { color: hue }) : hue
}
</script>
