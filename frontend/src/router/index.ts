import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
// La page d'accueil est chargée tout de suite ; les autres pages sont chargées à la demande (bundle d'entrée plus léger,
// et ECharts n'est téléchargé que lorsqu'on ouvre une page de graphiques).
import HeroSection from '../views/HeroSection.vue'

const routes: RouteRecordRaw[] = [
  { path: '/', name: 'Home', component: HeroSection, meta: { title: 'Ton patrimoine en graphiques' } },
  { path: '/newpage', name: 'NewPage', component: () => import('../views/NewPage.vue'), meta: { title: 'Connexion' } },
  {
    // /source reste valable (ancienne adresse de la page des onglets)
    path: '/sheet',
    alias: '/source',
    name: 'SheetPage',
    component: () => import('../views/SourcePage.vue'),
    meta: { title: 'GoogleSheet' },
  },
  {
    // Rubrique Graphiques : menu à gauche, page choisie à droite (GraphiquesLayout.vue).
    // Les enfants gardent leurs adresses d'origine (chemins absolus) ; /graphiques ouvre Portfolio Flow.
    path: '/graphiques',
    component: () => import('../views/GraphiquesLayout.vue'),
    children: [
      { path: '', name: 'EchartPage', redirect: '/portfolio-flow' },
      { path: '/portfolio-flow', name: 'PortfolioFlow', component: () => import('../views/PortfolioFlowPage.vue'), meta: { title: 'Portfolio Flow' } },
      { path: '/portfolio-snapshot', name: 'PortfolioSnapshot', component: () => import('../views/SnapshotPage.vue'), meta: { title: 'Portfolio Snapshot' } },
      { path: '/strategie', name: 'Strategy', component: () => import('../views/StrategyPage.vue'), meta: { title: 'Stratégie CTO' } },
      { path: '/enveloppes', name: 'Envelopes', component: () => import('../views/EnvelopesPage.vue'), meta: { title: 'Enveloppes' } },
      { path: '/volatilite', name: 'Volatility', component: () => import('../views/VolatilityPage.vue'), meta: { title: 'Volatilité' } },
      // Pas de meta.title : la page du graphique donne elle-même son titre
      { path: ':slug', name: 'ChartPage', component: () => import('../views/GraphiquePage.vue') },
    ],
  },
  // Simulation de Monte-Carlo : page à part, hors de la rubrique Graphiques (pas de menu à gauche)
  { path: '/simulation', name: 'Simulation', component: () => import('../views/SimulationPage.vue'), meta: { title: 'Simulation' } },
  // Ancienne adresse de la page des graphiques
  { path: '/echart', redirect: '/graphiques' },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('../views/NotFoundPage.vue'),
    meta: { title: 'Page introuvable' },
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition // retour arrière : on retrouve sa place

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // Ancre (#tarifs) : on s'arrête sous l'en-tête fixe de 64 px
    if (to.hash) return { el: to.hash, top: 88, behavior: reduceMotion ? 'auto' : 'smooth' }

    // Même page, seule la requête change (/sheet?onglet=…) : on ne remonte pas
    if (to.path === from.path) return false

    return { top: 0 }
  },
})

router.afterEach((to) => {
  const title = to.meta.title
  if (typeof title === 'string') document.title = `${title} | Overfolio`
})

export default router
