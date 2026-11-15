// 4. Répartition par compte ou courtier : table `portfolio`, colonnes Account / Broker.
// Une barre par compte (ou courtier), découpée par type d'actif avec les mêmes couleurs que l'anneau.

import { requireColumns, rowsOf, stackBy } from '../aggregate.js'
import { axisLabelStyle, baseOption, categoryAxis, legendTop, tooltipBox, tooltipHtml } from '../chartTheme.js'
import { capitalize, euro, percent, plural } from '../format.js'
import { AXIS, CONTEXT, FONT, INK, SURFACE, assignAssetColors } from '../palette.js'
import { dataSubtitle } from './common.js'

const TOTAL = 'Total'

/** Séries (types d'actifs) dans l'ordre fixe des couleurs, avec « Autres » si la palette est épuisée. */
export function stackModel(stacked) {
  const { colors, overflow } = assignAssetColors(stacked.series.map((serie) => serie.name))
  const folded = new Set(overflow)

  const series = stacked.series
    .filter((serie) => !folded.has(serie.name))
    .map((serie) => ({
      label: capitalize(serie.name),
      color: colors.get(serie.name).color,
      slot: colors.get(serie.name).slot,
      members: [serie.name],
    }))
    .sort((a, b) => a.slot - b.slot)

  if (overflow.length) {
    series.push({ label: 'Autres', color: CONTEXT, slot: 99, members: overflow })
  }

  const values = stacked.groups.map((group) =>
    series.map((serie) => serie.members.reduce((sum, member) => sum + stacked.value(group.name, member), 0)),
  )
  return { series, values, overflow }
}

export function stackedOption(groups, series, values) {
  // Dernier segment non nul de chaque barre : c'est lui qui a le bout arrondi
  const lastIndex = values.map((row) => row.reduce((last, value, index) => (value > 0 ? index : last), -1))

  return {
    ...baseOption(),
    grid: { left: 4, right: 110, top: 44, bottom: 8, containLabel: true },
    legend: legendTop(series.map((serie) => serie.label)),
    tooltip: tooltipBox({
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(31, 35, 40, 0.04)' } },
      formatter: (params) => {
        const first = [].concat(params)[0]
        const index = first?.dataIndex
        const group = groups[index]
        if (!group) return ''
        const rows = series
          .map((serie, s) => ({ serie, value: values[index][s] }))
          .filter((item) => item.value > 0)
          .map((item) => ({
            color: item.serie.color,
            label: item.serie.label,
            value: `${euro(item.value)} (${percent(item.value / group.total)})`,
          }))
        rows.push({ label: TOTAL, value: euro(group.total), strong: true })
        return tooltipHtml(group.name, rows)
      },
    }),
    xAxis: { type: 'value', show: false },
    yAxis: categoryAxis(
      groups.map((group) => group.name),
      {
        inverse: true,
        axisLine: { lineStyle: { color: AXIS } },
        axisLabel: { ...axisLabelStyle, color: INK, width: 150, overflow: 'truncate', hideOverlap: false },
      },
    ),
    series: [
      ...series.map((serie, s) => ({
        name: serie.label,
        type: 'bar',
        stack: 'total',
        barMaxWidth: 22,
        barCategoryGap: '45%',
        // Écart de 2 px entre segments : un filet de la couleur du fond, pas une bordure de couleur
        itemStyle: { color: serie.color, borderColor: SURFACE, borderWidth: 2 },
        data: groups.map((_, g) => {
          const value = values[g][s]
          if (!(value > 0)) return null
          return lastIndex[g] === s ? { value, itemStyle: { borderRadius: [0, 4, 4, 0] } } : value
        }),
      })),
      {
        // Série invisible de longueur 0 : elle porte seulement le total, écrit au bout de chaque barre
        name: TOTAL,
        type: 'bar',
        stack: 'total',
        silent: true,
        legendHoverLink: false,
        data: groups.map(() => 0),
        itemStyle: { color: 'transparent' },
        label: {
          show: true,
          position: 'right',
          distance: 8,
          formatter: (p) => euro(groups[p.dataIndex].total),
          color: INK,
          fontSize: 12,
          fontWeight: 600,
          fontFamily: FONT,
        },
      },
    ],
  }
}

export default {
  slug: 'repartition-comptes',
  title: 'Répartition par compte ou courtier',
  summary: 'Le contenu de chaque compte ou courtier, type d’actif par type d’actif.',
  group: 'repartition',
  thumb: 'stacked',
  table: 'portfolio',
  controls: [
    {
      key: 'groupBy',
      label: 'Regrouper par',
      // `column` : l'option n'est proposée que si la table a cette colonne
      options: [
        { value: 'Account', label: 'Compte', column: 'Account' },
        { value: 'Broker', label: 'Courtier', column: 'Broker' },
      ],
      default: 'Account',
    },
  ],
  explain: [
    'Chaque barre est un compte. Ses couleurs indiquent les types d’actifs qu’il contient, avec les mêmes couleurs que dans l’anneau des types d’actifs. Si ta table a une colonne Broker, un sélecteur permet de regrouper par courtier.',
    'Le total de chaque barre est écrit à son extrémité. Les barres sont triées de la plus grosse à la plus petite.',
  ],
  source: 'Table portfolio, colonnes Account ou Broker, Asset et Assets Master Currency (lignes supérieures à 0).',

  build(table, controls = {}) {
    const groupColumn = controls.groupBy === 'Broker' ? 'Broker' : 'Account'
    const groupLabel = groupColumn === 'Broker' ? 'Courtier' : 'Compte'
    const cols = requireColumns(table, {
      group: [groupColumn],
      asset: ['Asset'],
      value: ['Assets Master Currency'],
    })

    const stacked = stackBy(rowsOf(table), cols.group, cols.asset, cols.value, `${groupLabel} non renseigné`)
    if (!stacked.groups.length) {
      return { empty: 'Aucun montant supérieur à 0 dans la table portfolio.' }
    }

    const { series, values, overflow } = stackModel(stacked)
    const { groups } = stacked
    const grandTotal = groups.reduce((sum, group) => sum + group.total, 0)

    return {
      subtitle: dataSubtitle(table, 'Positions au'),
      summary: `${plural(groups.length, groupLabel.toLowerCase())}, découpés par type d’actif. Le plus gros : ${groups[0].name}, ${euro(groups[0].total)}.`,
      option: stackedOption(groups, series, values),
      height: groups.length * 44 + 76,
      note: overflow.length
        ? `Les types d’actifs ${overflow.map(capitalize).join(', ')} sont regroupés dans « Autres », faute de couleur disponible.`
        : '',
      table: {
        columns: [groupLabel, ...series.map((serie) => serie.label), 'Total'],
        numeric: [false, ...series.map(() => true), true],
        rows: [
          ...groups.map((group, g) => [
            group.name,
            ...series.map((_, s) => (values[g][s] > 0 ? euro(values[g][s]) : '–')),
            euro(group.total),
          ]),
          [
            'Total',
            ...series.map((_, s) => euro(values.reduce((sum, row) => sum + row[s], 0))),
            euro(grandTotal),
          ],
        ],
      },
    }
  },
}
