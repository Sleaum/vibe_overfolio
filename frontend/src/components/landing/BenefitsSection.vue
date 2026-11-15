<template>
  <section aria-labelledby="titre-avantages" class="section-y">
    <div class="page-container">
      <h2 id="titre-avantages" class="max-w-2xl text-h2 text-ink">
        Tu gardes ta feuille, Overfolio la rend lisible
      </h2>

      <ul class="mt-14 grid grid-cols-1 gap-x-10 gap-y-12 md:grid-cols-3">
        <li v-for="benefit in BENEFITS" :key="benefit.title">
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
          <h3 class="mt-5 text-h3 text-ink">{{ benefit.title }}</h3>
          <p class="mt-2 text-ink-2">{{ benefit.text }}</p>
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup>
const BENEFITS = [
  {
    icon: 'sheet',
    title: 'Ta feuille reste la source',
    text: 'Tu continues à tenir ton suivi dans Google Sheets. Overfolio lit tes onglets, rien de plus : il n’écrit pas dans ta feuille.',
  },
  {
    icon: 'split',
    title: 'Ta répartition en un coup d’œil',
    text: 'Types d’actifs, zones géographiques, comptes et courtiers : vois où se trouve ton patrimoine sans refaire un tableau croisé.',
  },
  {
    icon: 'check',
    title: 'Des chiffres que tu peux vérifier',
    text: 'Chaque graphique indique la table et les colonnes dont il vient, et s’affiche aussi sous forme de tableau.',
  },
]
</script>
