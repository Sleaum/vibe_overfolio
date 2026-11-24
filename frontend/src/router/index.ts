import { createRouter, createWebHistory, type RouteLocationNormalized, type RouteRecordRaw } from 'vue-router'
import { onLocaleChange, t } from '../i18n/index.js'
// La page d'accueil est chargée tout de suite ; les autres pages sont chargées à la demande (bundle d'entrée plus léger,
// et ECharts n'est téléchargé que lorsqu'on ouvre une page de graphiques).
import HeroSection from '../views/HeroSection.vue'

const routes: RouteRecordRaw[] = [
  { path: '/', name: 'Home', component: HeroSection, meta: { titleKey: 'pages.home' } },
  { path: '/newpage', name: 'NewPage', component: () => import('../views/NewPage.vue'), meta: { titleKey: 'pages.login' } },
  {
    // /source reste valable (ancienne adresse de la page des onglets)
    path: '/sheet',
    alias: '/source',
    name: 'SheetPage',
    component: () => import('../views/SourcePage.vue'),
    meta: { titleKey: 'pages.sheet' },
  },
  {
    // Rubrique Graphiques : menu à gauche, page choisie à droite (GraphiquesLayout.vue).
    // Les enfants gardent leurs adresses d'origine (chemins absolus) ; /graphiques ouvre Portfolio Flow.
    path: '/graphiques',
    component: () => import('../views/GraphiquesLayout.vue'),
    children: [
      { path: '', name: 'EchartPage', redirect: '/portfolio-flow' },
      { path: '/portfolio-flow', name: 'PortfolioFlow', component: () => import('../views/PortfolioFlowPage.vue'), meta: { titleKey: 'pages.flow' } },
      { path: '/portfolio-snapshot', name: 'PortfolioSnapshot', component: () => import('../views/SnapshotPage.vue'), meta: { titleKey: 'pages.snapshot' } },
      { path: '/strategie', name: 'Strategy', component: () => import('../views/StrategyPage.vue'), meta: { titleKey: 'pages.strategy' } },
      { path: '/enveloppes', name: 'Envelopes', component: () => import('../views/EnvelopesPage.vue'), meta: { titleKey: 'pages.envelopes' } },
      { path: '/volatilite', name: 'Volatility', component: () => import('../views/VolatilityPage.vue'), meta: { titleKey: 'pages.volatility' } },
      // Pas de meta.titleKey : la page du graphique donne elle-même son titre
      { path: ':slug', name: 'ChartPage', component: () => import('../views/GraphiquePage.vue') },
    ],
  },
  // Simulation de Monte-Carlo : page à part, hors de la rubrique Graphiques (pas de menu à gauche)
  { path: '/simulation', name: 'Simulation', component: () => import('../views/SimulationPage.vue'), meta: { titleKey: 'pages.simulation' } },
  {
    // Rubrique Models : menu à gauche (ModelsLayout.vue), Classic (/modeles, les portefeuilles modèles) et
    // Target (/modeles/target, ta répartition cible et le plan pour l'atteindre)
    path: '/modeles',
    component: () => import('../views/ModelsLayout.vue'),
    children: [
      { path: '', name: 'Models', component: () => import('../views/ModelsClassicPage.vue'), meta: { titleKey: 'pages.models' } },
      { path: 'target', name: 'ModelsTarget', component: () => import('../views/ModelsTargetPage.vue'), meta: { titleKey: 'pages.modelsTarget' } },
    ],
  },
  // Ancienne adresse de la page des graphiques
  { path: '/echart', redirect: '/graphiques' },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('../views/NotFoundPage.vue'),
    meta: { titleKey: 'pages.notFound' },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition // retour arrière : on retrouve sa place

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // Ancre (#section) : on s'arrête sous l'en-tête fixe de 64 px
    if (to.hash) return { el: to.hash, top: 88, behavior: reduceMotion ? 'auto' : 'smooth' }

    // Même page, seule la requête change (/sheet?onglet=…) : on ne remonte pas
    if (to.path === from.path) return false

    return { top: 0 }
  },
})

// Titre de l'onglet : meta.titleKey (clé de i18n/*.json), traduit dans la langue active et refait quand elle change
function setTitle(route: RouteLocationNormalized) {
  const key = route.meta.titleKey
  if (typeof key === 'string') document.title = `${t(key)} | Overfolio`
}
router.afterEach(setTitle)
onLocaleChange(() => setTitle(router.currentRoute.value))

export default router
