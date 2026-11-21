<template>
  <footer class="border-t border-line bg-wash">
    <div class="page-container py-14">
      <div class="grid grid-cols-12 gap-y-10 md:gap-x-8">
        <div class="col-span-12 md:col-span-5">
          <p class="text-xl font-extrabold tracking-tight text-ink">Overfolio</p>
          <p class="mt-3 max-w-sm text-ink-2">
            Ton Google Sheet, mis en graphiques : la répartition et l’évolution de ton patrimoine.
          </p>
        </div>

        <nav class="col-span-6 md:col-span-3 md:col-start-10" aria-label="Pages du site">
          <h2 class="font-semibold text-ink">Pages</h2>
          <ul class="mt-3 space-y-2">
            <li><router-link to="/sheet" class="text-ink-2 hover:text-ink hover:underline">GoogleSheet</router-link></li>
            <li><router-link to="/graphiques" class="text-ink-2 hover:text-ink hover:underline">Graphiques</router-link></li>
            <li><router-link to="/simulation" class="text-ink-2 hover:text-ink hover:underline">Simulation</router-link></li>
          </ul>
        </nav>
      </div>

      <p class="mt-12 border-t border-line pt-6 text-sm text-ink-3">
        © {{ year }} Overfolio. Outil de suivi de patrimoine : il ne donne ni conseil en investissement ni recommandation.
      </p>
    </div>
  </footer>
</template>

<script setup>
const year = new Date().getFullYear()
</script>
