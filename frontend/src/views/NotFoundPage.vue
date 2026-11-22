<template>
  <div class="page-container section-y">
    <div class="max-w-2xl">
      <h1 class="text-h2 text-ink">{{ t('pages.notFound') }}</h1>
      <p class="mt-4 text-lead text-ink-2">
        {{ t('notFound.text') }}
      </p>
      <div class="mt-8 flex flex-wrap items-center gap-x-7 gap-y-4">
        <AppButton to="/">{{ t('notFound.home') }}</AppButton>
        <router-link to="/graphiques" class="rounded-md font-semibold text-accent underline underline-offset-4 hover:text-accent-hover">
          {{ t('home.seeCharts') }}
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import AppButton from '../components/ui/AppButton.vue'

const { t } = useI18n()
</script>
