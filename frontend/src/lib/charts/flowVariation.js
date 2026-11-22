// Portfolio Flow 4 : variation du patrimoine d'un mois à l'autre, en %.
// Table `_history`, colonnes Date et Assets Master Currency : total des actifs au dernier relevé de chaque mois.

import { requireColumns, rowsOf } from '../aggregate.js'
import { axisLabelStyle, baseOption, categoryAxis, tooltipBox, tooltipHtml, valueAxis, zoomSlider } from '../chartTheme.js'
import { euro, formatMonthKey, formatMonthKeyTiny, percent } from '../format.js'
import { AXIS, HOVER_SHADE, SERIES } from '../palette.js'
import { monthEnds, monthsSubtitle, signedPercent, skippedNote, totalsByDate } from './flowData.js'

const UP = SERIES[0]
const DOWN = SERIES[1]

export function variationOption(changes) {
  const zoom = changes.length > 30
  return {
    ...baseOption(),
    grid: { left: 4, right: 8, top: 16, bottom: zoom ? 44 : 8, containLabel: true },
    tooltip: tooltipBox({
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: HOVER_SHADE } },
      formatter: (params) => {
        const change = changes[[].concat(params)[0]?.dataIndex]
        if (!change) return ''
        return tooltipHtml(formatMonthKey(change.key), [
          { color: change.pct >= 0 ? UP : DOWN, label: 'Variation', value: signedPercent(change.pct), strong: true },
          { label: 'Écart', value: `${change.delta > 0 ? '+' : change.delta < 0 ? '-' : ''}${euro(Math.abs(change.delta))}` },
          { label: 'Patrimoine', value: euro(change.total) },
        ])
      },
    }),
    // Étiquettes de mois en bas du graphique (pas sur le zéro, où elles toucheraient les barres négatives)
    xAxis: categoryAxis(changes.map((change) => formatMonthKeyTiny(change.key)), {
      axisLine: { onZero: false, lineStyle: { color: AXIS } },
      axisLabel: { ...axisLabelStyle, hideOverlap: true },
    }),
    yAxis: valueAxis((value) => `${value} %`),
    dataZoom: zoom ? [zoomSlider()] : undefined,
    series: [
      {
        name: 'Variation',
        type: 'bar',
        // Ligne du zéro, un peu plus marquée que les filets
        markLine: {
          silent: true,
          symbol: 'none',
          label: { show: false },
          lineStyle: { color: AXIS, width: 1.5, type: 'solid' },
          data: [{ yAxis: 0 }],
        },
        barMaxWidth: 18,
        barCategoryGap: '40%',
        data: changes.map((change) => ({
          value: Math.round(change.pct * 100) / 100,
          itemStyle: {
            color: change.pct >= 0 ? UP : DOWN,
            // Le bout arrondi est du côté opposé à l'axe du zéro
            borderRadius: change.pct >= 0 ? [4, 4, 0, 0] : [0, 0, 4, 4],
          },
        })),
      },
    ],
  }
}

export default {
  slug: 'variation-mensuelle',
  title: 'Variation mensuelle',
  summary: 'De combien ton patrimoine monte ou baisse, en %, d’un mois à l’autre.',
  table: '_history',
  minWidth: 720,
  explain: [
    'Chaque barre compare le total de tes actifs à la fin d’un mois avec celui du mois précédent. Les barres bleues au-dessus du zéro sont des hausses, les barres orange en dessous sont des baisses.',
    'Cette variation mélange deux causes : ce que tu as versé ou retiré, et ce que le marché a fait. Pour les séparer, il faut l’onglet inout, qui n’est pas encore utilisé ici.',
  ],
  source: 'Table _history, colonnes Date et Assets Master Currency, additionnées par date ; dernier relevé de chaque mois.',

  build(table) {
    const cols = requireColumns(table, { date: ['Date'], value: ['Assets Master Currency'] })
    const rows = rowsOf(table)
    const totals = totalsByDate(rows, cols.date, cols.value)
    const ends = monthEnds(rows, cols.date)
    const months = ends.map((month) => ({ ...month, total: totals.get(month.iso) ?? 0 }))

    const changes = []
    for (let i = 1; i < months.length; i++) {
      const previous = months[i - 1].total
      if (!(previous > 0)) continue
      const delta = months[i].total - previous
      changes.push({ key: months[i].key, total: months[i].total, delta, pct: (delta / previous) * 100 })
    }
    if (!changes.length) return { empty: 'Il faut au moins deux mois de relevés dans la table _history.' }

    const last = changes[changes.length - 1]
    return {
      subtitle: monthsSubtitle(ends),
      summary:
        `Variation mensuelle du patrimoine entre ${formatMonthKey(changes[0].key)} et ${formatMonthKey(last.key)}. ` +
        `Dernier mois : ${signedPercent(last.pct)}.`,
      option: variationOption(changes),
      height: 320,
      table: {
        columns: ['Mois', 'Variation', 'Écart', 'Patrimoine'],
        numeric: [false, true, true, true],
        rows: [...changes]
          .reverse()
          .map((change) => [
            formatMonthKey(change.key),
            signedPercent(change.pct),
            `${change.delta > 0 ? '+' : change.delta < 0 ? '-' : ''}${euro(Math.abs(change.delta))}`,
            euro(change.total),
          ]),
      },
      note: [
        `Moyenne mensuelle : ${signedPercent(changes.reduce((sum, change) => sum + change.pct, 0) / changes.length)}.`,
        skippedNote(ends.skipped),
      ].join(' '),
    }
  },
}
