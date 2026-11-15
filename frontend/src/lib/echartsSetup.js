// Enregistre uniquement les morceaux d'ECharts utilisés par les graphiques (le reste n'est pas embarqué).
// main.ts en enregistre déjà une partie pour l'ancienne page Board ; enregistrer deux fois est sans effet.

import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart, LineChart, PieChart, SankeyChart, ScatterChart } from 'echarts/charts'
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
} from 'echarts/components'

use([
  CanvasRenderer,
  BarChart,
  LineChart,
  PieChart,
  SankeyChart,
  ScatterChart,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
])
