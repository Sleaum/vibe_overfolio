<template>
  <footer class="border-t border-line bg-wash print:hidden">
    <div class="page-container py-14">
      <div class="grid grid-cols-12 gap-y-10 md:gap-x-8">
        <div class="col-span-12 md:col-span-5">
          <p class="text-xl font-extrabold tracking-tight text-ink">Overfolio</p>
          <p class="mt-3 max-w-sm text-ink-2">
            {{ t('footer.tagline') }}
          </p>
        </div>

        <nav class="col-span-6 md:col-span-3 md:col-start-10" :aria-label="t('footer.pagesLabel')">
          <h2 class="font-semibold text-ink">{{ t('footer.pages') }}</h2>
          <ul class="mt-3 space-y-2">
            <li><router-link to="/sheet" class="text-ink-2 hover:text-ink hover:underline">{{ MENU_NAMES.sheet }}</router-link></li>
            <li><router-link to="/graphiques" class="text-ink-2 hover:text-ink hover:underline">{{ MENU_NAMES.charts }}</router-link></li>
            <li><router-link to="/simulation" class="text-ink-2 hover:text-ink hover:underline">{{ MENU_NAMES.simulation }}</router-link></li>
          </ul>
        </nav>
      </div>

      <p class="mt-12 border-t border-line pt-6 text-sm text-ink-3">
        {{ t('footer.legal', { year }) }}
      </p>
    </div>
  </footer>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { MENU_NAMES } from '../i18n/menu.js'

const { t } = useI18n()
const year = new Date().getFullYear()
</script>
