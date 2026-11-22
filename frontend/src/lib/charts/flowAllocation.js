// Portfolio Flow 2 : répartition du patrimoine par type d'actif, en % de chaque mois (barres empilées à 100 %).
// Table `_history`, colonnes Date, Asset et Assets Master Currency.

import { requireColumns, rowsOf } from '../aggregate.js'
import { baseOption, categoryAxis, legendTop, tooltipBox, tooltipHtml, valueAxis, zoomSlider } from '../chartTheme.js'
import { euro, formatMonthKey, formatMonthKeyTiny, percent } from '../format.js'
import { HOVER_SHADE, SURFACE } from '../palette.js'
import { assetMonthly, monthsSubtitle, skippedNote } from './flowData.js'

export function allocationOption(model) {
  const { months, series, values, totals } = model
  const zoom = months.length > 30
  const share = (s, m) => (totals[m] > 0 ? (values[s][m] / totals[m]) * 100 : 0)
  // Dernier segment non nul de chaque barre : c'est lui qui a le haut arrondi
  const topSegment = months.map((_, m) => series.reduce((last, _s, s) => (values[s][m] > 0 ? s : last), -1))

  return {
    ...baseOption(),
    grid: { left: 4, right: 8, top: 56, bottom: zoom ? 44 : 8, containLabel: true },
    legend: legendTop(series.map((serie) => serie.label)),
    tooltip: tooltipBox({
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: HOVER_SHADE } },
      formatter: (params) => {
        const m = [].concat(params)[0]?.dataIndex
        if (months[m] === undefined) return ''
        const rows = series
          .map((serie, s) => ({ serie, value: values[s][m] }))
          .filter((item) => item.value > 0)
          .reverse() // même ordre que la pile : le haut de la barre en premier
          .map((item) => ({
            color: item.serie.color,
            label: item.serie.label,
            value: `${percent(item.value / totals[m])} · ${euro(item.value)}`,
          }))
        rows.push({ label: 'Total', value: euro(totals[m]), strong: true })
        return tooltipHtml(formatMonthKey(months[m].key), rows)
      },
    }),
    xAxis: categoryAxis(months.map((month) => formatMonthKeyTiny(month.key))),
    yAxis: valueAxis((value) => `${value} %`, { min: 0, max: 100, interval: 20 }),
    dataZoom: zoom ? [zoomSlider()] : undefined,
    series: series.map((serie, s) => ({
      name: serie.label,
      type: 'bar',
      stack: 'total',
      barMaxWidth: 22,
      barCategoryGap: '30%',
      // Écart de 2 px entre segments : un filet de la couleur du fond
      itemStyle: { color: serie.color, borderColor: SURFACE, borderWidth: 2 },
      data: months.map((_, m) => {
        const value = share(s, m)
        if (!(value > 0)) return null
        return topSegment[m] === s ? { value, itemStyle: { borderRadius: [4, 4, 0, 0] } } : value
      }),
    })),
  }
}

export default {
  slug: 'repartition-mensuelle',
  title: 'Répartition par type d’actif, mois par mois',
  summary: 'La part de chaque type d’actif dans ton patrimoine, à chaque mois.',
  table: '_history',
  minWidth: 720,
  explain: [
    'Chaque barre représente 100 % de ton patrimoine à la fin d’un mois, découpé par type d’actif. Les couleurs sont celles de l’anneau des types d’actifs.',
    'Seuls les actifs comptent (les dettes sont exclues). Passe la souris sur une barre pour lire la part et le montant de chaque type.',
  ],
  source: 'Table _history, colonnes Date, Asset et Assets Master Currency (montants supérieurs à 0), dernier relevé de chaque mois.',

  build(table) {
    const cols = requireColumns(table, { date: ['Date'], asset: ['Asset'], value: ['Assets Master Currency'] })
    const model = assetMonthly(rowsOf(table), cols.date, cols.asset, cols.value)
    if (!model.months.length) return { empty: 'Aucun montant supérieur à 0 dans la table _history.' }

    const last = model.months.length - 1
    const biggest = model.series
      .map((serie, s) => ({ serie, value: model.values[s][last] }))
      .sort((a, b) => b.value - a.value)[0]

    return {
      subtitle: monthsSubtitle(model.months),
      summary:
        `Répartition par type d’actif entre ${formatMonthKey(model.months[0].key)} et ${formatMonthKey(model.months[last].key)}. ` +
        `Au dernier mois, ${biggest.serie.label} pèse ${percent(biggest.value / model.totals[last])}.`,
      option: allocationOption(model),
      height: 400,
      table: {
        columns: ['Mois', ...model.series.map((serie) => serie.label), 'Total'],
        numeric: [false, ...model.series.map(() => true), true],
        rows: model.months
          .map((month, m) => [
            formatMonthKey(month.key),
            ...model.series.map((_, s) => (model.values[s][m] > 0 ? percent(model.values[s][m] / model.totals[m]) : '–')),
            euro(model.totals[m]),
          ])
          .reverse(),
      },
      note: [
        model.series.some((serie) => serie.label === 'Autres')
          ? 'Les types d’actifs au-delà des 8 couleurs du site sont regroupés dans « Autres ».'
          : '',
        skippedNote(model.skipped),
      ]
        .filter(Boolean)
        .join(' '),
    }
  },
}
