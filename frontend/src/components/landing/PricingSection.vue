<!--
  Tarif. Un seul abonnement : le prix est dans la constante PRICE ci-dessous (à garder identique à ton prix Stripe).
  L'ancre #tarifs est celle des boutons « S'abonner » de l'en-tête et du pied de page.
-->
<template>
  <section id="tarifs" aria-labelledby="titre-tarifs" class="section-y bg-wash">
    <div class="page-container">
      <div class="grid grid-cols-12 items-start gap-y-10 lg:gap-x-8">
        <div class="col-span-12 lg:col-span-5">
          <h2 id="titre-tarifs" class="text-h2 text-ink">Un seul abonnement</h2>
          <p class="mt-4 max-w-md text-lead text-ink-2">
            Tu paies à l’année et tu retrouves tout Overfolio : la page GoogleSheet et les quatre pages de graphiques.
          </p>
        </div>

        <div class="col-span-12 lg:col-span-6 lg:col-start-7">
          <div class="rounded-xl border border-line bg-white p-6 shadow-soft sm:p-8">
            <p class="font-semibold text-ink">Abonnement annuel</p>
            <p class="mt-3 flex items-baseline gap-2">
              <span class="text-5xl font-extrabold tracking-tight text-ink">{{ PRICE }}</span>
              <span class="text-ink-2">par an</span>
            </p>

            <ul class="mt-7 space-y-3">
              <li v-for="item in INCLUDED" :key="item" class="flex gap-3">
                <svg
                  viewBox="0 0 20 20"
                  class="mt-1 h-5 w-5 shrink-0 text-accent"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="M4 10.5l4 4 8-9" />
                </svg>
                <span class="text-ink">{{ item }}</span>
              </li>
            </ul>

            <div class="mt-8">
              <SubscriptionButton block />
              <p class="mt-4 text-sm text-ink-3">
                Paiement sécurisé par Stripe. Overfolio ne voit pas ton numéro de carte.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import SubscriptionButton from '../SubscriptionButton.vue'

// À confirmer : l'ancien bouton affichait 35 €/an, mais le backend crée aujourd'hui une session à 20,00 €.
const PRICE = '35 €'

const INCLUDED = [
  'Les cinq onglets de ta feuille en tableau, avec recherche et pagination',
  'Les quatre pages de graphiques, chacune avec son explication',
  'L’actualisation d’un clic depuis la page GoogleSheet',
  'Ta feuille n’est jamais modifiée',
]
</script>
