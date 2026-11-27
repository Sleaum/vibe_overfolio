<!--
  États d'une page ou d'un graphique (status de composables/usePageModel.js) : chargement, table impossible à lire,
  données qui ne conviennent pas, rien à afficher ; sinon le contenu (slot par défaut).

  Props :
  - status, error ({ message, status }), missingTable, problem, empty, reload : ceux de usePageModel ;
  - table : nom de la table, pour le message « pas encore dans la base » et le lien vers la page GoogleSheet ;
  - kind : « page » (une page entière : Snapshot, Strategy, Simulation) ou « chart » (un graphique : textes et
    encadrés des graphiques) ;
  - loadingText : texte du chargement (par défaut, celui d'un graphique) ;
  - loadingHeight, emptyHeight : hauteur des encadrés (classes Tailwind écrites en entier) ;
  - emptyLink : lien vers la page GoogleSheet aussi quand il n'y a rien à afficher ;
  - errorTitle : un seul titre pour toute erreur (table illisible ou données inadaptées), avec le message tel quel
    et toujours le lien vers la page GoogleSheet (page Simulation).
-->
<template>
  <div
    v-if="status === 'loading'"
    role="status"
    class="flex items-center justify-center bg-wash text-ink-2 motion-safe:animate-pulse"
    :class="[frame, loadingHeight]"
  >
    {{ loadingText || t('chartUi.loading') }}
  </div>

  <div v-else-if="status === 'error' || (errorTitle && status === 'problem')" role="alert" class="border border-danger-line bg-danger-wash" :class="[frame, padding]">
    <p class="font-semibold text-danger">{{ texts.errorTitle }}</p>
    <p class="mt-1 text-ink">{{ texts.errorText }}</p>
    <div class="mt-4 flex flex-wrap gap-3">
      <AppButton v-if="errorTitle || missingTable" :to="sheetLink" variant="secondary" size="sm">{{ t('chartUi.openSheet') }}</AppButton>
      <AppButton variant="secondary" size="sm" @click="reload">{{ t('chartUi.retry') }}</AppButton>
    </div>
  </div>

  <div v-else-if="status === 'problem'" role="alert" class="border border-danger-line bg-danger-wash" :class="[frame, padding]">
    <p class="font-semibold text-danger">{{ kind === 'page' ? t('page.problemTitle') : t('chartUi.problemTitle') }}</p>
    <p class="mt-1 text-ink">{{ problem }}</p>
    <p class="mt-3 text-sm text-ink-2">{{ t('chartUi.problemHint') }}</p>
  </div>

  <div
    v-else-if="status === 'empty'"
    class="flex flex-col items-center justify-center border border-dashed border-line-strong bg-wash px-6 text-center"
    :class="[frame, emptyHeight]"
  >
    <p class="font-semibold text-ink">{{ t('chartUi.emptyTitle') }}</p>
    <p class="mt-1 max-w-md text-ink-2">{{ empty }}</p>
    <AppButton v-if="emptyLink" :to="sheetLink" variant="secondary" size="sm" class="mt-4">{{ t('chartUi.openSheet') }}</AppButton>
  </div>

  <slot v-else />
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AppButton from './ui/AppButton.vue'

const props = defineProps({
  status: { type: String, required: true },
  error: { type: Object, default: null },
  missingTable: { type: Boolean, default: false },
  problem: { type: String, default: '' },
  empty: { type: String, default: '' },
  reload: { type: Function, default: () => {} },
  table: { type: String, required: true },
  kind: { type: String, default: 'chart' }, // 'page' ou 'chart'
  loadingText: { type: String, default: '' },
  loadingHeight: { type: String, default: 'h-80' },
  emptyHeight: { type: String, default: 'h-56' },
  emptyLink: { type: Boolean, default: false },
  errorTitle: { type: String, default: '' },
})

const { t } = useI18n()

// Une page entière : encadré plus arrondi, plus aéré, détaché du titre ; un graphique : dans sa carte
const frame = computed(() => (props.kind === 'page' ? 'mt-10 rounded-xl' : 'rounded-lg'))
const padding = computed(() => (props.kind === 'page' ? 'p-6' : 'p-5'))

// La page GoogleSheet s'ouvre directement sur l'onglet de la table, prêt à être actualisé
const sheetLink = computed(() => ({ path: '/sheet', query: { onglet: props.table } }))

const texts = computed(() => {
  if (props.errorTitle) return { errorTitle: props.errorTitle, errorText: props.problem || props.error?.message || '' }
  if (!props.missingTable) return { errorTitle: t('chartUi.loadErrorTitle'), errorText: props.error?.message ?? '' }
  return props.kind === 'page'
    ? { errorTitle: t('page.tableMissing', { table: props.table }), errorText: t('page.notSyncedYet') }
    : { errorTitle: t('chartUi.missingTableTitle'), errorText: t('chartUi.missingTableText', { table: props.table }) }
})
</script>
