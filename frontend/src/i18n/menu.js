// Noms des menus : toujours en anglais, quelle que soit la langue du site (choix du projet).
// Ils ne sont donc pas dans fr.json / en.json / th.json. Tout le reste de l'interface est traduit,
// y compris les titres des pages et les phrases qui renvoient à ces menus (qui reprennent ces noms tels quels).

export const MENU_NAMES = {
  // En-tête et pied de page
  sheet: 'GoogleSheet',
  charts: 'Charts',
  simulation: 'Simulation',
  models: 'Models',
  // Menu de la rubrique Models (ModelsLayout.vue)
  target: 'Target',
  classic: 'Classic',
  // Menu de la rubrique Charts (GraphiquesLayout.vue, lib/charts/index.js)
  flow: 'Flow',
  snapshot: 'Snapshot',
  envelopes: 'Envelopes',
  strategy: 'Strategy',
  volatility: 'Volatility',
  budget: 'Budget',
}
