<!--
  Bandeau de l'export PDF (bouton PDF de l'en-tête, lib/pdfExport.js) : progression, annulation, erreur.
  Pendant l'export, un voile transparent empêche de cliquer dans les pages que le site parcourt.
  data-pdf-ignore : ni le voile ni le bandeau n'apparaissent dans le PDF.
-->
<template>
  <div v-if="pdfExport.running || pdfExport.error" data-pdf-ignore>
    <div v-if="pdfExport.running" class="fixed inset-0 z-50 cursor-wait" aria-hidden="true"></div>
    <div
      class="fixed bottom-4 right-4 z-[60] w-[min(24rem,calc(100vw-2rem))] rounded-xl border border-line bg-paper p-4 shadow-lift"
      :role="pdfExport.error ? 'alert' : 'status'"
      aria-live="polite"
    >
      <template v-if="pdfExport.running">
        <p class="font-semibold text-ink">{{ t('pdf.progress', { done: Math.min(pdfExport.done + 1, pdfExport.total), total: pdfExport.total }) }}</p>
        <div class="mt-3 h-1.5 overflow-hidden rounded-full bg-wash">
          <div class="h-full rounded-full bg-accent transition-[width]" :style="{ width: `${(pdfExport.done / pdfExport.total) * 100}%` }"></div>
        </div>
        <p class="mt-2 text-sm text-ink-2">{{ t('pdf.hint') }}</p>
        <AppButton class="mt-3" variant="secondary" size="sm" @click="pdfExport.cancelled = true">{{ t('pdf.cancel') }}</AppButton>
      </template>
      <template v-else>
        <p class="text-danger">{{ t('pdf.error', { message: pdfExport.error }) }}</p>
        <AppButton class="mt-3" variant="secondary" size="sm" @click="pdfExport.error = ''">{{ t('pdf.close') }}</AppButton>
      </template>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import AppButton from './ui/AppButton.vue'
import { pdfExport } from '../lib/pdfExport.js'

const { t } = useI18n()
</script>
