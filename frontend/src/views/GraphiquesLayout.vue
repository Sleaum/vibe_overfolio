<!--
  Rubrique « Graphiques » : menu en colonne à gauche (les entrées de MENU dans lib/charts/index.js),
  page choisie à droite (<router-view>). /graphiques ouvre la première entrée.
  Les adresses des pages ne changent pas : /portfolio-flow, /portfolio-snapshot, /strategie, /graphiques/<slug>.
  Sur petit écran, le menu devient une rangée d'onglets au-dessus de la page, qui défile horizontalement.
  En haut du menu, le bouton Brut / Net choisit les montants des graphiques de Flow, Snapshot et Envelopes (lib/amounts.js).
-->
<template>
  <div class="page-container py-8 lg:flex lg:items-start lg:gap-10 lg:py-12">
    <aside class="lg:sticky lg:top-24 lg:w-56 lg:shrink-0">
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
      <nav :aria-label="MENU_NAMES.charts">
        <p class="hidden px-3 text-xs font-semibold uppercase tracking-wide text-ink-3 lg:block">{{ MENU_NAMES.charts }}</p>
        <ul ref="list" class="-mx-5 flex gap-2 overflow-x-auto px-5 pb-2 sm:-mx-8 sm:px-8 lg:mx-0 lg:mt-3 lg:flex-col lg:gap-1 lg:overflow-visible lg:p-0">
          <li v-for="item in MENU" :key="item.key" class="shrink-0">
            <router-link
              :to="item.to"
              :aria-current="item.key === activeKey ? 'page' : undefined"
              class="flex items-center gap-3 whitespace-nowrap rounded-lg border px-3 py-2 text-[0.9375rem] font-medium transition-colors lg:border-transparent"
              :class="
                item.key === activeKey
                  ? 'border-line-strong bg-wash text-ink lg:border-transparent'
                  : 'border-line text-ink-2 hover:bg-wash hover:text-ink'
              "
            >
              <span
                class="hidden h-5 w-1 rounded-full lg:block"
                :class="item.key === activeKey ? 'bg-accent' : 'bg-transparent'"
                aria-hidden="true"
              />
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
import { useI18n } from 'vue-i18n'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import SegmentedControl from '../components/ui/SegmentedControl.vue'
import { MENU_NAMES } from '../i18n/menu.js'
import { AMOUNT_MODES, amountMode, setAmountMode } from '../lib/amounts.js'
import { useRoute } from 'vue-router'
import { MENU, menuKeyFor } from '../lib/charts/index.js'

const { t } = useI18n()
const amountOptions = computed(() => AMOUNT_MODES.map((mode) => ({ value: mode, label: t(`amounts.mode.${mode}`) })))

const route = useRoute()
const activeKey = computed(() => menuKeyFor(route))

// Sur mobile, le menu est une rangée qui défile : on amène l'onglet actif dans la vue
const list = ref(null)
async function revealActive() {
  await nextTick()
  const row = list.value
  const active = row?.querySelector('[aria-current="page"]')
  if (!row || !active || row.scrollWidth <= row.clientWidth) return
  row.scrollTo({ left: active.offsetLeft - row.clientWidth / 2 + active.offsetWidth / 2, behavior: 'smooth' })
}
onMounted(revealActive)
watch(activeKey, revealActive)
</script>
