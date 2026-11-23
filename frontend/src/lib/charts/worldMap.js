// Carte du monde de la page Strategy : chaque pays coloré selon le montant de tes actions dont la colonne Area
// désigne ce pays (plus c'est foncé, plus le montant est grand), avec une bulle à sa taille au centre du pays : les petits
// pays (Taïwan, Pays-Bas…) restent visibles. Au survol : le pays, son montant, sa part et ses actions.
// Les frontières (world-atlas, 110m, ~100 Ko) ne sont chargées qu'à l'ouverture de la page : loadWorldMap().
// `model` vient de lib/strategy.js (buildStrategy, champ `map`).

import { registerMap } from 'echarts/core'
import { baseOption, tooltipBox, tooltipHtml } from '../chartTheme.js'
import { countryCenter, geoName } from '../countries.js'
import { formatAmount, percent } from '../format.js'
import { BLUE, GRID, INK_2, NAVY, SURFACE } from '../palette.js'
import { tint } from '../strategy.js'
import { t } from '../../i18n/index.js'

export const MAP_NAME = 'world'
let loading = null

/** Charge et enregistre les frontières des pays une seule fois (les appels suivants attendent le même chargement). */
export function loadWorldMap() {
  if (!loading) {
    loading = Promise.all([import('world-atlas/countries-110m.json'), import('topojson-client')]).then(([atlas, topojson]) => {
      const topology = atlas.default ?? atlas
      registerMap(MAP_NAME, cleanWorld(topojson.feature(topology, topology.objects.countries)))
    })
    loading.catch(() => {
      loading = null // nouvel essai possible
    })
  }
  return loading
}

// Terres australes inutiles ici, et qui écrasent la carte vers le bas
const DROPPED = new Set(['Antarctica', 'Fr. S. Antarctic Lands'])

/**
 * Prépare les frontières : retire l'Antarctique, et recolle les pays coupés par la ligne de changement de date
 * (Russie, Fidji) : sans cela, leurs polygones sont tracés d'un bord à l'autre de la carte, en bandes horizontales.
 */
function cleanWorld(world) {
  const fixRing = (ring) => {
    const lons = ring.map(([lon]) => lon)
    if (Math.max(...lons) - Math.min(...lons) <= 180) return ring
    return ring.map(([lon, lat]) => [lon < 0 ? lon + 360 : lon, lat])
  }
  const fixGeometry = (geometry) => {
    if (geometry?.type === 'Polygon') return { ...geometry, coordinates: geometry.coordinates.map(fixRing) }
    if (geometry?.type === 'MultiPolygon') return { ...geometry, coordinates: geometry.coordinates.map((polygon) => polygon.map(fixRing)) }
    return geometry
  }
  return {
    ...world,
    features: world.features
      .filter((feature) => !DROPPED.has(feature.properties?.name))
      .map((feature) => ({ ...feature, geometry: fixGeometry(feature.geometry) })),
  }
}

const MAX_ROWS = 8 // actions listées dans l'infobulle d'un pays ; le reste en « Autres (n) »

export function worldMapOption(model) {
  const max = Math.max(...model.countries.map((country) => country.value), 1)
  const byGeo = new Map(model.countries.map((country) => [geoName(country.code), country]))
  // Couleur et bulle sur la racine carrée du montant : un petit pays reste visible à côté d'un très gros
  const scale = (value) => Math.sqrt(Math.max(value, 0))
  const bubbles = model.countries.filter((country) => countryCenter(country.code))

  return {
    ...baseOption(),
    tooltip: tooltipBox({
      trigger: 'item',
      formatter: (p) => {
        const country = p?.data?.country ?? byGeo.get(p?.name)
        if (!country) return ''
        const shown = country.items.slice(0, MAX_ROWS)
        const rest = country.items.slice(MAX_ROWS)
        const rows = [
          { color: BLUE, label: t('chart.amount'), value: formatAmount(country.value), strong: true },
          { label: t('chart.shareOfTotal'), value: percent(country.share) },
          ...shown.map((item) => ({ label: item.name, value: formatAmount(item.value) })),
        ]
        if (rest.length) {
          rows.push({ label: t('data.othersCount', { count: rest.length }), value: formatAmount(rest.reduce((sum, item) => sum + item.value, 0)) })
        }
        return tooltipHtml(country.name, rows)
      },
    }),
    // Échelle de couleur : du bleu très clair (petit montant) au bleu du site (plus gros pays)
    visualMap: {
      show: false,
      seriesIndex: 0,
      min: 0,
      max: scale(max),
      inRange: { color: [tint(BLUE, 0.6), BLUE] },
    },
    // Fond de carte commun aux deux séries ; pays sans action : gris très clair, filet de la couleur du fond
    geo: {
      map: MAP_NAME,
      roam: false,
      top: 8,
      bottom: 8,
      itemStyle: { areaColor: GRID, borderColor: SURFACE, borderWidth: 0.6 },
      emphasis: { disabled: true },
      select: { disabled: true },
      silent: true,
    },
    series: [
      {
        type: 'map',
        geoIndex: 0,
        data: model.countries.map((country) => ({ name: geoName(country.code), value: scale(country.value), country })),
      },
      {
        type: 'scatter',
        coordinateSystem: 'geo',
        // Bulles bleu nuit, bordées de blanc : elles se détachent des pays bleus
        itemStyle: { color: NAVY, opacity: 0.9, borderColor: SURFACE, borderWidth: 1 },
        label: {
          show: true,
          position: 'right',
          distance: 4,
          color: INK_2,
          fontSize: 11,
          // Liseré de la couleur du fond : le nom reste lisible sur un pays coloré
          textBorderColor: SURFACE,
          textBorderWidth: 2,
          formatter: (p) => p?.data?.country?.name ?? '',
        },
        labelLayout: { hideOverlap: true },
        data: bubbles.map((country) => ({
          name: country.name,
          value: [...countryCenter(country.code), country.value],
          symbolSize: 8 + 26 * (scale(country.value) / scale(max)),
          country,
        })),
      },
    ],
  }
}
