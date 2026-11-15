// Briques ECharts communes : mêmes axes, mêmes filets, mêmes infobulles sur les 7 graphiques.
// Règles appliquées : marques fines, filets de 1 px pleins et discrets, texte en encre (jamais en couleur de série).

import { esc } from './format.js'
import { AXIS, FONT, GRID, INK, INK_2, SURFACE } from './palette.js'

const labelStyle = { color: INK_2, fontSize: 12, fontFamily: FONT }

/** Options de base : police, durées d'animation (coupées par BaseChart si « réduire les animations »). */
export function baseOption() {
  return {
    textStyle: { fontFamily: FONT, color: INK_2 },
    animationDuration: 700,
    animationDurationUpdate: 300,
    animationEasing: 'cubicOut',
  }
}

/** Pastille de couleur d'une infobulle. */
export function swatch(color) {
  return (
    `<span style="display:inline-block;width:10px;height:10px;border-radius:3px;` +
    `background:${color};margin-right:8px;vertical-align:-1px"></span>`
  )
}

/**
 * Contenu d'une infobulle : un titre puis des lignes « étiquette ... valeur ».
 * Les textes viennent de la feuille : ils sont échappés.
 * rows : [{ color?, label, value, strong? }]
 */
export function tooltipHtml(title, rows) {
  const head = title
    ? `<div style="font-weight:600;color:${INK};margin-bottom:6px">${esc(title)}</div>`
    : ''
  const body = rows
    .map(
      (row) =>
        `<div style="display:flex;justify-content:space-between;gap:24px;line-height:1.7">` +
        `<span style="color:${INK_2}">${row.color ? swatch(row.color) : ''}${esc(row.label)}</span>` +
        `<span style="font-weight:${row.strong ? 700 : 600};font-variant-numeric:tabular-nums;color:${INK}">` +
        `${esc(row.value)}</span></div>`,
    )
    .join('')
  return head + body
}

/** Cadre de l'infobulle : fond blanc, filet fin, coins arrondis, ombre très douce. */
export function tooltipBox(extra = {}) {
  return {
    confine: true,
    backgroundColor: SURFACE,
    borderColor: GRID,
    borderWidth: 1,
    padding: [10, 14],
    textStyle: { color: INK, fontSize: 13, fontFamily: FONT },
    extraCssText: 'border-radius:12px;box-shadow:0 8px 24px -8px rgba(31,35,40,0.22);',
    ...extra,
  }
}

/** Légende : en haut à gauche, pastilles carrées (ou petit trait pour une courbe). */
export function legendTop(data, { line = false } = {}) {
  return {
    data,
    top: 0,
    left: 0,
    icon: 'roundRect',
    itemWidth: line ? 16 : 12,
    itemHeight: line ? 3 : 12,
    itemGap: 20,
    textStyle: { color: INK_2, fontSize: 13, fontFamily: FONT },
  }
}

/** Axe de catégories (noms, mois…). */
export function categoryAxis(data, extra = {}) {
  return {
    type: 'category',
    data,
    axisTick: { show: false },
    axisLine: { lineStyle: { color: AXIS } },
    axisLabel: { ...labelStyle, hideOverlap: true },
    ...extra,
  }
}

/** Axe de valeurs : sans trait, filets pleins de 1 px. */
export function valueAxis(formatter, extra = {}) {
  return {
    type: 'value',
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { ...labelStyle, formatter },
    splitLine: { lineStyle: { color: GRID, width: 1, type: 'solid' } },
    ...extra,
  }
}

/** Curseur de zoom discret, utile seulement quand il y a beaucoup de points. */
export function zoomSlider() {
  return {
    type: 'slider',
    height: 16,
    bottom: 4,
    borderColor: GRID,
    backgroundColor: SURFACE,
    fillerColor: 'rgba(42, 120, 214, 0.12)',
    dataBackground: { lineStyle: { color: AXIS }, areaStyle: { color: GRID } },
    handleSize: 14,
    brushSelect: false,
    showDetail: false,
  }
}

export const axisLabelStyle = labelStyle
