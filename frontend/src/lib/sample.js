// Données FICTIVES, uniquement pour les aperçus de la page de présentation.
// Rien ici ne vient de ta feuille : la page de vente ne doit jamais afficher tes vrais montants.

import { t } from '../i18n/index.js'
import { formatDateNumeric } from './format.js'

/** 25 relevés mensuels, de novembre 2024 à novembre 2026, au format de la table `history`. */
export function sampleHistory() {
  const wobble = [0, 1.2, -0.6, 1.9, 0.4, -1.4, 1.1, 0.8, -0.9, 1.6, 0.3, -0.5]
  const rows = []
  for (let i = 0; i < 25; i += 1) {
    const date = new Date(Date.UTC(2024, 10 + i, 1)).toISOString().slice(0, 10)
    rows.push({
      Date: date,
      'Assets Master Currency': Math.round(158_000 + i * 2_150 + wobble[i % wobble.length] * 1_600),
      'Liabilities Master Currency': Math.round(-41_500 + i * 480),
    })
  }
  return {
    name: 'history',
    columns: ['Date', 'Assets Master Currency', 'Liabilities Master Currency'],
    rows,
    synced_at: null,
  }
}

/** Types d'actifs d'un portefeuille imaginaire (valeurs en euros). */
export function sampleAssets() {
  return [
    { name: 'public equity', value: 87_000 },
    { name: 'real estate', value: 30_000 },
    { name: 'fiat', value: 24_000 },
    { name: 'crypto', value: 13_000 },
  ]
}

/** Lignes de l'aperçu de la table `portfolio`. */
export function samplePortfolioRows() {
  const date = formatDateNumeric('2026-11-14')
  return [
    { date, asset: 'public equity', instrument: t('home.sample.worldEtf'), amount: 52_000 },
    { date, asset: 'public equity', instrument: 'ETF S&P 500', amount: 35_000 },
    { date, asset: 'real estate', instrument: 'SCPI', amount: 30_000 },
    { date, asset: 'fiat', instrument: t('home.sample.savings'), amount: 24_000 },
    { date, asset: 'crypto', instrument: 'Bitcoin', amount: 13_000 },
  ]
}
