<!--
  Page d'accueil « / » : présentation et vente.
  Ordre : promesse + aperçu → trois avantages → aperçu du produit → comment ça marche → questions.
-->
<template>
  <div>
    <section aria-labelledby="titre-principal" class="pb-6 pt-12 sm:pt-16 lg:pb-12 lg:pt-24">
      <div class="page-container">
        <div class="grid grid-cols-12 items-center gap-y-14 lg:gap-x-10">
          <div class="col-span-12 lg:col-span-6">
            <h1 id="titre-principal" class="text-display text-ink">L’allocation avant la sélection</h1>
            <p class="mt-6 max-w-xl text-lead text-ink-2">
              Overfolio transforme ton Google Sheet en graphiques clairs, pour voir l’évolution et la répartition de ton
              patrimoine avant de faire tes arbitrages.
            </p>

            <div class="mt-9 flex flex-wrap items-center gap-x-7 gap-y-4">
              <AppButton :to="{ name: 'SheetPage' }">Commencer</AppButton>
              <router-link
                to="/graphiques"
                class="rounded-md font-semibold text-accent underline underline-offset-4 hover:text-accent-hover"
              >
                Voir les graphiques
              </router-link>
            </div>

            <p class="mt-6 max-w-md text-sm text-ink-3">
              Ta feuille reste la tienne : Overfolio la lit, il ne la modifie pas.
            </p>
          </div>

          <div class="col-span-12 lg:col-span-6">
            <HeroPreview />
          </div>
        </div>
      </div>
    </section>

    <BenefitsSection />
    <ProductPreview />
    <StepsSection />
    <FaqSection />
  </div>
</template>

<script setup>
import AppButton from '../components/ui/AppButton.vue'
import BenefitsSection from '../components/landing/BenefitsSection.vue'
import FaqSection from '../components/landing/FaqSection.vue'
import HeroPreview from '../components/landing/HeroPreview.vue'
import ProductPreview from '../components/landing/ProductPreview.vue'
import StepsSection from '../components/landing/StepsSection.vue'
</script>
