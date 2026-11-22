<template>
  <section aria-labelledby="titre-avantages" class="section-y">
    <div class="page-container">
      <h2 id="titre-avantages" class="max-w-2xl text-h2 text-ink">
        {{ t('home.benefits.title') }}
      </h2>

      <ul class="mt-14 grid grid-cols-1 gap-x-10 gap-y-12 md:grid-cols-3">
        <li v-for="benefit in BENEFITS" :key="benefit.key">
          <!-- Pictogramme : trois traits d'encre et l'accent, sans pastille autour -->
          <svg viewBox="0 0 32 32" class="h-8 w-8 text-accent" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <template v-if="benefit.icon === 'sheet'">
              <rect x="4" y="5" width="24" height="22" rx="3" />
              <path d="M4 13h24M4 20h24M13 5v22" />
              <rect x="14" y="14" width="13" height="6" fill="currentColor" fill-opacity="0.18" stroke="none" />
            </template>
            <template v-else-if="benefit.icon === 'split'">
              <circle cx="16" cy="16" r="11" />
              <path d="M16 5v11h11" />
            </template>
            <template v-else>
              <rect x="5" y="4" width="22" height="24" rx="3" />
              <path d="M10 11h12M10 16h12" />
              <path d="M10 22.5l3 3 6-6.5" />
            </template>
          </svg>
          <h3 class="mt-5 text-h3 text-ink">{{ t(`home.benefits.${benefit.key}.title`) }}</h3>
          <p class="mt-2 text-ink-2">{{ t(`home.benefits.${benefit.key}.text`) }}</p>
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
const { t } = useI18n()

// Textes : rubrique home.benefits de i18n/*.json
const BENEFITS = [
  { icon: 'sheet', key: 'source' },
  { icon: 'split', key: 'split' },
  { icon: 'check', key: 'check' },
]
</script>
