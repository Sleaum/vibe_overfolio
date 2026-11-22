// Enregistre uniquement les morceaux d'ECharts utilisés par les graphiques (le reste n'est pas embarqué).
// main.ts en enregistre déjà une partie pour l'ancienne page Board ; enregistrer deux fois est sans effet.

import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart, LineChart, MapChart, PieChart, SankeyChart, ScatterChart, SunburstChart } from 'echarts/charts'
import {
  DataZoomComponent,
  GeoComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TitleComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components'

use([
  CanvasRenderer,
  BarChart,
  LineChart,
  MapChart,
  PieChart,
  SankeyChart,
  ScatterChart,
  SunburstChart,
  DataZoomComponent,
  GeoComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TitleComponent,
  TooltipComponent,
  VisualMapComponent,
])
