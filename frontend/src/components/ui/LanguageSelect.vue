<!--
  Choix de la langue (en-tête) : menu natif du navigateur, accessible au clavier et lisible par les lecteurs d'écran.
  Chaque langue est écrite dans sa propre langue (Français, English, ไทย). Liste et mémorisation : i18n/index.js.
-->
<template>
  <label class="relative inline-flex h-11 items-center">
    <span class="sr-only">{{ t('language.label') }}</span>
    <!-- Icône globe : la liste se reconnaît même dans une langue qu'on ne lit pas -->
    <svg viewBox="0 0 24 24" class="pointer-events-none absolute left-2.5 h-4 w-4 text-ink-2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </svg>
    <select
      :value="locale"
      class="h-9 cursor-pointer appearance-none rounded-lg border border-transparent bg-transparent pl-8 pr-2 text-[0.9375rem] font-medium text-ink-2 transition-colors hover:bg-wash hover:text-ink"
      @change="setLocale($event.target.value)"
    >
      <option v-for="language in languages" :key="language.code" :value="language.code" :lang="language.code">
        {{ language.name }}
      </option>
    </select>
  </label>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { useLocale } from '../../composables/useLocale.js'

const { t } = useI18n()
const { locale, languages, setLocale } = useLocale()
</script>
