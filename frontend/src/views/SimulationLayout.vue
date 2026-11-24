<!--
  Rubrique « Simulation » (/simulation), sur le modèle de Charts et Models : à gauche, le titre Simulation et le menu
  des méthodes (lib/simulationMenu.js) ; à droite, la page choisie (<router-view>). /simulation ouvre Monte Carlo.
  Une méthode encore en préparation porte la mention « bientôt » et ouvre sa présentation (SimulationMethodPage.vue).
  Pas de bouton Brut / Net ici : Monte Carlo simule toujours le patrimoine net (actifs, et dettes qui se remboursent).
  Contenu aussi large que la rubrique Models ; sur petit écran, le menu devient une rangée d'onglets au-dessus de la page.
-->
<template>
  <div class="mx-auto w-full max-w-[88rem] px-5 py-8 sm:px-8 lg:flex lg:items-start lg:gap-10 lg:py-12">
    <aside class="lg:sticky lg:top-24 lg:w-52 lg:shrink-0">
      <nav :aria-label="MENU_NAMES.simulation">
        <p class="hidden px-3 text-xs font-semibold uppercase tracking-wide text-ink-3 lg:block">{{ MENU_NAMES.simulation }}</p>
        <ul ref="list" class="relative -mx-5 flex gap-2 overflow-x-auto px-5 pb-2 sm:-mx-8 sm:px-8 lg:mx-0 lg:mt-3 lg:flex-col lg:gap-1 lg:overflow-visible lg:p-0">
          <li v-for="item in SIMULATION_MENU" :key="item.key" class="shrink-0">
            <router-link
              :to="item.to"
              :aria-current="item.to === route.path ? 'page' : undefined"
              class="flex items-center gap-3 whitespace-nowrap rounded-lg border px-3 py-2 text-[0.9375rem] font-medium transition-colors lg:border-transparent"
              :class="
                item.to === route.path
                  ? 'border-line-strong bg-wash text-ink lg:border-transparent'
                  : 'border-line text-ink-2 hover:bg-wash hover:text-ink'
              "
            >
              <span class="hidden h-5 w-1 rounded-full lg:block" :class="item.to === route.path ? 'bg-accent' : 'bg-transparent'" aria-hidden="true" />
              <span class="flex-1">{{ item.title }}</span>
              <span v-if="!item.ready" class="rounded-md border border-line bg-wash px-1.5 py-px text-xs font-normal text-ink-3">
                {{ t('simulationLayout.soon') }}
              </span>
            </router-link>
          </li>
        </ul>
      </nav>
    </aside>

    <div class="mt-6 min-w-0 flex-1 lg:mt-0">
      <router-view />
    </div>
  </div>
</template>

<script setup>
import { nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { MENU_NAMES } from '../i18n/menu.js'
import { SIMULATION_MENU } from '../lib/simulationMenu.js'

const { t } = useI18n()
const route = useRoute()

// Sur mobile, le menu est une rangée qui défile : on amène l'onglet actif dans la vue (comme Charts)
const list = ref(null)
async function revealActive() {
  await nextTick()
  const row = list.value
  const active = row?.querySelector('[aria-current="page"]')
  if (!row || !active || row.scrollWidth <= row.clientWidth) return
  row.scrollTo({ left: active.offsetLeft - row.clientWidth / 2 + active.offsetWidth / 2, behavior: 'smooth' })
}
onMounted(revealActive)
watch(() => route.path, revealActive)
</script>
