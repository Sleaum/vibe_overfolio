<template>
  <div class="page-container section-y">
    <div class="max-w-2xl">
      <h1 class="text-h2 text-ink">Page introuvable</h1>
      <p class="mt-4 text-lead text-ink-2">
        L’adresse que tu as ouverte n’existe pas, ou plus. Tu peux repartir de l’accueil.
      </p>
      <div class="mt-8 flex flex-wrap items-center gap-x-7 gap-y-4">
        <AppButton to="/">Retour à l’accueil</AppButton>
        <router-link to="/graphiques" class="rounded-md font-semibold text-accent underline underline-offset-4 hover:text-accent-hover">
          Voir les graphiques
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import AppButton from '../components/ui/AppButton.vue'
</script>
