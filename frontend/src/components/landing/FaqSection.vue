<!--
  Questions fréquentes. <details>/<summary> natifs : accessibles au clavier (Entrée / Espace) et aux lecteurs d'écran
  sans JavaScript. Le chevron tourne à l'ouverture (animation coupée si l'utilisateur réduit les animations).
-->
<template>
  <section aria-labelledby="titre-faq" class="section-y">
    <div class="page-container">
      <div class="grid grid-cols-12 gap-y-10 lg:gap-x-8">
        <div class="col-span-12 lg:col-span-4">
          <h2 id="titre-faq" class="text-h2 text-ink">{{ t('home.faq.title') }}</h2>
        </div>

        <div class="col-span-12 lg:col-span-7 lg:col-start-6">
          <div class="divide-y divide-line border-y border-line">
            <details v-for="item in ITEMS" :key="item" class="group">
              <summary
                class="flex cursor-pointer list-none items-center justify-between gap-6 rounded-lg py-5 text-lg font-semibold text-ink [&::-webkit-details-marker]:hidden"
              >
                <span>{{ t(`home.faq.${item}.q`) }}</span>
                <svg
                  viewBox="0 0 20 20"
                  class="h-5 w-5 shrink-0 text-ink-2 transition-transform duration-150 group-open:rotate-180"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 8l5 5 5-5" />
                </svg>
              </summary>
              <p class="pb-6 pr-10 text-ink-2">{{ t(`home.faq.${item}.a`) }}</p>
            </details>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
const { t } = useI18n()

// Textes : rubrique home.faq de i18n/*.json (q : question, a : réponse)
const ITEMS = ['sheet', 'access', 'update', 'advice']
</script>
