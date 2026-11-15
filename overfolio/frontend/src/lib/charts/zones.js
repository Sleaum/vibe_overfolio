// 3. Répartition par zone géographique : table `portfolio`, colonne Area, barres horizontales triées.

import { requireColumns, rowsOf, splitBy } from '../aggregate.js'
import { euro, percent, plural } from '../format.js'
import { dataSubtitle } from './common.js'
import { rankedBarsHeight, rankedBarsOption } from './rankedBars.js'

export default {
  slug: 'repartition-zones',
  title: 'Répartition par zone géographique',
  summary: 'Où se trouvent tes actifs, zone par zone.',
  group: 'repartition',
  thumb: 'bars',
  table: 'portfolio',
  explain: [
    'Chaque barre est une zone géographique. Sa longueur est le total des actifs situés dans cette zone, écrit au bout de la barre.',
    'Les zones sont triées de la plus grande à la plus petite. L’infobulle donne aussi la part de chaque zone dans le total.',
  ],
  source: 'Table portfolio, colonnes Area et Assets Master Currency (lignes supérieures à 0).',

  build(table) {
    const cols = requireColumns(table, { area: ['Area'], value: ['Assets Master Currency'] })
    const { entries, total } = splitBy(rowsOf(table), cols.area, cols.value, 'Zone non renseignée')
    if (!entries.length) {
      return { empty: 'Aucun montant supérieur à 0 dans la table portfolio.' }
    }

    return {
      subtitle: dataSubtitle(table, 'Positions au'),
      summary: `${plural(entries.length, 'zone')}. La plus grande : ${entries[0].name}, ${euro(entries[0].value)}.`,
      option: rankedBarsOption(entries, total),
      height: rankedBarsHeight(entries.length),
      table: {
        columns: ['Zone', 'Montant', 'Part'],
        numeric: [false, true, true],
        rows: [
          ...entries.map((e) => [e.name, euro(e.value), percent(e.value / total)]),
          ['Total', euro(total), percent(1)],
        ],
      },
    }
  },
}
