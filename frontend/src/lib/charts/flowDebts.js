// Portfolio Flow : tes dettes, une courbe par type d'actif, mois par mois (mode Brut du bouton Brut / Net).
// Table `history` : la dette de chaque ligne (« Liabilities Master Currency », ou la colonne EUR négative des anciens
// relevés) est comptée en valeur positive dans son type d'actif (le prêt de la maison dans « real estate »).
// En mode Net, les dettes sont déjà retirées des autres graphiques : celui-ci n'est pas affiché sur la page Flow.

import { rowsOf, toNumber } from '../aggregate.js'
import { amountMode } from '../amounts.js'
import flowAssets from './flowAssets.js'
import { t, tList } from '../../i18n/index.js'

export default {
  slug: 'dettes-par-actif',
  amounts: 'debt', // la table arrive avec les dettes seules, en positif (lib/amounts.js)
  hidden: () => amountMode.value === 'net',
  get title() {
    return t('charts.debts.title')
  },
  get summary() {
    return t('charts.debts.summary')
  },
  table: 'history',
  projection: true, // + le mois prochain, tiré de portfolio (googlesheet/projection.py)
  minWidth: 720,
  get explain() {
    return tList('charts.debts.explain')
  },
  get source() {
    return t('charts.debts.source')
  },

  build(table) {
    const hasDebt = rowsOf(table).some((row) => toNumber(row['Assets Master Currency']) > 0)
    if (!hasDebt) return { empty: t('charts.debts.none') }
    return flowAssets.build(table)
  },
}
