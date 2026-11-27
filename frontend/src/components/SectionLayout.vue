<!--
  Rubrique à menu (Charts, Models, Simulation) : menu en colonne à gauche, page choisie à droite.
  Sur petit écran, le menu devient une rangée d'onglets au-dessus de la page, qui défile horizontalement ;
  l'onglet actif y est ramené au milieu à chaque changement de page.

  Props :
  - title : nom du menu (MENU_NAMES, toujours en anglais), affiché au-dessus des entrées et lu par les lecteurs d'écran ;
  - items : [{ key, to, title, badge? }] ; badge : petite mention à droite du titre (« bientôt ») ;
  - activeKey : clé de l'entrée active, si la rubrique la calcule elle-même ; sans elle, l'entrée dont `to` est
    l'adresse de la page ;
  - width : { column, content } : classes de largeur de la colonne (« lg:w-56 ») et du conteneur
    (« page-container », ou une largeur propre à la rubrique).
  Emplacements : above-menu (bouton Brut / Net), below-menu (couleurs des actifs), et le contenu (par défaut <router-view>).
-->
<template>
  <div class="lg:flex lg:items-start lg:gap-10 py-8 lg:py-12" :class="width.content">
    <aside class="lg:sticky lg:top-24 lg:shrink-0" :class="width.column">
      <slot name="above-menu" />
      <nav :aria-label="title">
        <p class="hidden px-3 text-xs font-semibold uppercase tracking-wide text-ink-3 lg:block">{{ title }}</p>
        <!-- relative : offsetLeft des onglets mesuré depuis la rangée, pour les ramener au milieu -->
        <ul ref="list" class="relative -mx-5 flex gap-2 overflow-x-auto px-5 pb-2 sm:-mx-8 sm:px-8 lg:mx-0 lg:mt-3 lg:flex-col lg:gap-1 lg:overflow-visible lg:p-0">
          <li v-for="item in items" :key="item.key" class="shrink-0">
            <router-link
              :to="item.to"
              :aria-current="isActive(item) ? 'page' : undefined"
              class="flex items-center gap-3 whitespace-nowrap rounded-lg border px-3 py-2 text-[0.9375rem] font-medium transition-colors lg:border-transparent"
              :class="
                isActive(item)
                  ? 'border-line-strong bg-wash text-ink lg:border-transparent'
                  : 'border-line text-ink-2 hover:bg-wash hover:text-ink'
              "
            >
              <span class="hidden h-5 w-1 rounded-full lg:block" :class="isActive(item) ? 'bg-accent' : 'bg-transparent'" aria-hidden="true" />
              <span class="flex-1">{{ item.title }}</span>
              <span v-if="item.badge" class="rounded-md border border-line bg-wash px-1.5 py-px text-xs font-normal text-ink-3">
                {{ item.badge }}
              </span>
            </router-link>
          </li>
        </ul>
      </nav>
      <slot name="below-menu" />
    </aside>

    <div class="mt-6 min-w-0 flex-1 lg:mt-0">
      <slot><router-view /></slot>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

const props = defineProps({
  title: { type: String, required: true },
  items: { type: Array, required: true },
  // Absente : on compare les adresses. Donnée, même null (aucune entrée active), elle décide seule.
  activeKey: { type: String, default: undefined },
  width: { type: Object, required: true },
})

const route = useRoute()
const current = computed(() =>
  props.activeKey !== undefined ? props.activeKey : (props.items.find((item) => item.to === route.path)?.key ?? null),
)
const isActive = (item) => item.key === current.value

const list = ref(null)
async function revealActive() {
  await nextTick()
  const row = list.value
  const active = row?.querySelector('[aria-current="page"]')
  if (!row || !active || row.scrollWidth <= row.clientWidth) return
  row.scrollTo({ left: active.offsetLeft - row.clientWidth / 2 + active.offsetWidth / 2, behavior: 'smooth' })
}
onMounted(revealActive)
watch(current, revealActive)
</script>
