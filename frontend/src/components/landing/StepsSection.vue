<template>
  <section aria-labelledby="titre-etapes" class="section-y">
    <div class="page-container">
      <h2 id="titre-etapes" class="max-w-2xl text-h2 text-ink">{{ t('home.steps.title') }}</h2>

      <!-- Vraie suite d'étapes : liste ordonnée, numéros décoratifs masqués aux lecteurs d'écran -->
      <ol class="mt-14 grid grid-cols-1 gap-x-10 gap-y-12 md:grid-cols-3">
        <li v-for="(step, index) in STEPS" :key="step">
          <div class="flex items-center gap-4">
            <span
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-accent text-lg font-bold text-accent"
              aria-hidden="true"
            >
              {{ index + 1 }}
            </span>
            <span v-if="index < STEPS.length - 1" class="hidden h-px flex-1 bg-line-strong md:block" aria-hidden="true"></span>
          </div>
          <h3 class="mt-5 text-h3 text-ink">{{ t(`home.steps.${step}.title`) }}</h3>
          <p class="mt-2 text-ink-2">{{ t(`home.steps.${step}.text`) }}</p>
        </li>
      </ol>
    </div>
  </section>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
const { t } = useI18n()

// Textes : rubrique home.steps de i18n/*.json
const STEPS = ['connect', 'sync', 'follow']
</script>
