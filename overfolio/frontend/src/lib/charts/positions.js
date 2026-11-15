// 5. Plus grosses positions : table `portfolio`, colonnes Instrument et « Assets Master Currency », top 10.

import { findColumn, requireColumns, rowsOf, splitBy, toLabel } from '../aggregate.js'
import { euro, percent } from '../format.js'
import { dataSubtitle } from './common.js'
import { rankedBarsHeight, rankedBarsOption } from './rankedBars.js'

const TOP = 10

export default {
  slug: 'plus-grosses-positions',
  title: 'Plus grosses positions',
  summary: 'Les 10 lignes qui pèsent le plus dans ton patrimoine.',
  group: 'repartition',
  thumb: 'rank',
  table: 'portfolio',
  explain: [
    'Chaque barre est un instrument (action, fonds, crypto, compte…). Si le même instrument est détenu sur plusieurs comptes, ses montants sont additionnés.',
    'Le classement s’arrête aux 10 plus gros. L’infobulle indique le poids de chaque position dans le total de tes actifs.',
  ],
  source: 'Table portfolio, colonnes Instrument et Assets Master Currency (lignes supérieures à 0).',

  build(table) {
    const cols = requireColumns(table, { instrument: ['Instrument'], value: ['Assets Master Currency'] })
    // Quand l'instrument est vide, on se rabat sur le ticker, puis le sous-type, puis le type d'actif
    const fallbacks = ['Ticker', 'Sub Asset', 'Asset'].map((name) => findColumn(table.columns, [name])).filter(Boolean)
    const labelled = rowsOf(table).map((row) => {
      const candidates = [cols.instrument, ...fallbacks].map((column) => toLabel(row[column], ''))
      return { label: candidates.find(Boolean) || 'Non renseigné', value: row[cols.value] }
    })

    const { entries, total } = splitBy(labelled, 'label', 'value')
    if (!entries.length) {
      return { empty: 'Aucun montant supérieur à 0 dans la table portfolio.' }
    }

    const top = entries.slice(0, TOP)
    const topTotal = top.reduce((sum, entry) => sum + entry.value, 0)

    return {
      subtitle: dataSubtitle(table, 'Positions au'),
      summary: `Les ${top.length} plus grosses positions. La première : ${top[0].name}, ${euro(top[0].value)}.`,
      option: rankedBarsOption(top, total),
      height: rankedBarsHeight(top.length),
      note: `Ces ${top.length} positions représentent ${percent(topTotal / total)} des ${euro(total)} d’actifs.`,
      table: {
        columns: ['Rang', 'Instrument', 'Montant', 'Part du total'],
        numeric: [true, false, true, true],
        rows: top.map((entry, index) => [String(index + 1), entry.name, euro(entry.value), percent(entry.value / total)]),
      },
    }
  },
}
