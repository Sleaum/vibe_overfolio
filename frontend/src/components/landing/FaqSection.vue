<!--
  Questions fréquentes. <details>/<summary> natifs : accessibles au clavier (Entrée / Espace) et aux lecteurs d'écran
  sans JavaScript. Le chevron tourne à l'ouverture (animation coupée si l'utilisateur réduit les animations).
-->
<template>
  <section aria-labelledby="titre-faq" class="section-y">
    <div class="page-container">
      <div class="grid grid-cols-12 gap-y-10 lg:gap-x-8">
        <div class="col-span-12 lg:col-span-4">
          <h2 id="titre-faq" class="text-h2 text-ink">Questions fréquentes</h2>
        </div>

        <div class="col-span-12 lg:col-span-7 lg:col-start-6">
          <div class="divide-y divide-line border-y border-line">
            <details v-for="item in ITEMS" :key="item.question" class="group">
              <summary
                class="flex cursor-pointer list-none items-center justify-between gap-6 rounded-lg py-5 text-lg font-semibold text-ink [&::-webkit-details-marker]:hidden"
              >
                <span>{{ item.question }}</span>
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
              <p class="pb-6 pr-10 text-ink-2">{{ item.answer }}</p>
            </details>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
const ITEMS = [
  {
    question: 'Que doit contenir ma feuille Google Sheets ?',
    answer:
      'Overfolio cherche cinq onglets par leur nom : portfolio, inout, stock, budget et _history. Chaque page indique les colonnes dont elle a besoin. S’il en manque une, elle te dit laquelle, et les autres pages continuent de s’afficher.',
  },
  {
    question: 'Overfolio peut-il modifier ma feuille ou voir mes comptes bancaires ?',
    answer:
      'Non. Overfolio ne se connecte à aucune banque : il lit uniquement la feuille que tu partages avec lui, sans rien y écrire. Les lignes lues sont copiées dans sa base de données pour que les pages s’affichent vite. Si tu retires le partage dans Google Sheets, Overfolio ne peut plus la lire.',
  },
  {
    question: 'Comment les chiffres sont-ils mis à jour ?',
    answer:
      'À la demande. Sur la page GoogleSheet, le bouton Actualiser relit l’onglet affiché. La date et l’heure de la dernière synchronisation restent visibles, et chaque graphique rappelle la date de ses données.',
  },
  {
    question: 'Overfolio me dit-il quoi acheter ou vendre ?',
    answer:
      'Non. Overfolio montre ce que contient ta feuille : il ne recommande aucun placement et ne prédit rien. Ses graphiques t’aident à voir ta situation d’ensemble avant de prendre tes propres décisions.',
  },
  {
    question: 'Comment se passe le paiement ?',
    answer:
      'Le paiement est géré par Stripe. Tu es redirigé vers sa page sécurisée et tu vois le montant avant de valider. Overfolio ne voit jamais ton numéro de carte.',
  },
]
</script>
