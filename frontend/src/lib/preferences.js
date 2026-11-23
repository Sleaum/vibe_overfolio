// Préférences de la personne, gardées par le navigateur (localStorage) : un seul endroit pour toutes.
// Quand les comptes existeront (page /newpage), ce module sera le seul à changer pour les ranger sur le compte.
//
// Pas d'import dans ce fichier : il est lu aussi par Node (vite.config.ts, pour le script de index.html).

/** Nom de chaque préférence → clé dans le navigateur. */
export const PREFERENCES = {
  theme: 'overfolio-theme', // 'light' | 'dark' ; absente = suivre le système
  locale: 'overfolio-locale', // code de langue (i18n/index.js) ; absente = langue du navigateur
  simulation: 'overfolio.simulation.v1', // réglages de la page Simulation (JSON)
  amounts: 'overfolio-amounts', // 'gross' | 'net' : bouton Brut / Net de Charts (lib/amounts.js)
  currency: 'overfolio-currency', // devise d'affichage de Charts et Simulation (lib/displayCurrency.js) ; absente = euro
  volatility: 'overfolio-volatility', // périodes de Volatility en mois, « 1,3,6 » (lib/volatilityWindows.js) ; absente = 1,3,12
  performance: 'overfolio-performance', // périodes de Snapshot en jours, « 30,90 » (lib/performanceWindows.js) ; absente = 30,90,365
  // Ancien emplacement des couleurs des types d'actifs : elles sont désormais sur le profil, en base.
  // Lu une fois pour les recopier sur le profil, puis effacé (applyProfileAssetColors de lib/palette.js).
  assetColors: 'overfolio-asset-colors',
}

/** Valeur enregistrée, ou null (absente, ou stockage indisponible en navigation privée). */
export function readPreference(name) {
  try {
    return localStorage.getItem(PREFERENCES[name])
  } catch {
    return null
  }
}

/** Enregistre une valeur ; null l'efface. Sans stockage, le choix vaut pour cette visite. */
export function writePreference(name, value) {
  try {
    if (value === null || value === undefined) localStorage.removeItem(PREFERENCES[name])
    else localStorage.setItem(PREFERENCES[name], value)
  } catch {
    // Stockage indisponible : rien à faire
  }
}
