<!--
  Rubrique « Models » (/modeles), sur le modèle de Charts : à gauche, le bouton Brut / Net (le même choix que celui de
  Charts, lib/amounts.js), le titre Models et son menu ; à droite, la page choisie (<router-view>).
  Menu : Target (/modeles/target, ta répartition cible et le plan pour l'atteindre) et Classic (/modeles, les
  portefeuilles modèles). Noms des entrées toujours en anglais (i18n/menu.js).
  Contenu plus large que les autres pages (le tableau de Classic a besoin de place à côté du menu).
  Sur petit écran, le menu devient une rangée d'onglets au-dessus de la page.
-->
<template>
  <div class="mx-auto w-full max-w-[88rem] px-5 py-8 sm:px-8 lg:flex lg:items-start lg:gap-10 lg:py-12">
    <aside class="lg:sticky lg:top-24 lg:w-48 lg:shrink-0">
      <!-- Montants : brut (tes actifs) ou net (actifs moins dettes) ; choix gardé par le navigateur -->
      <div class="mb-5 lg:px-3">
        <SegmentedControl
          :model-value="amountMode"
          :options="amountOptions"
          :label="t('amounts.label')"
          @update:model-value="setAmountMode"
        />
        <p class="mt-2 max-w-xs text-xs text-ink-3">{{ t(`amounts.help.${amountMode}`) }}</p>
      </div>
      <nav :aria-label="MENU_NAMES.models">
        <p class="hidden px-3 text-xs font-semibold uppercase tracking-wide text-ink-3 lg:block">{{ MENU_NAMES.models }}</p>
        <ul class="-mx-5 flex gap-2 overflow-x-auto px-5 pb-2 sm:-mx-8 sm:px-8 lg:mx-0 lg:mt-3 lg:flex-col lg:gap-1 lg:overflow-visible lg:p-0">
          <li v-for="item in MENU" :key="item.to" class="shrink-0">
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
              {{ item.title }}
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
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import SegmentedControl from '../components/ui/SegmentedControl.vue'
import { MENU_NAMES } from '../i18n/menu.js'
import { AMOUNT_MODES, amountMode, setAmountMode } from '../lib/amounts.js'

const { t } = useI18n()
const route = useRoute()

const MENU = [
  { to: '/modeles/target', title: MENU_NAMES.target },
  { to: '/modeles', title: MENU_NAMES.classic },
]

const amountOptions = computed(() => AMOUNT_MODES.map((mode) => ({ value: mode, label: t(`amounts.mode.${mode}`) })))
</script>
