import './assets/tailwind.css'

import { createApp } from 'vue'
import App from './App.vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import router from './router'
import { i18n } from './i18n/index.js'
import { startSession } from './lib/profile.js'

import {
  CanvasRenderer
} from 'echarts/renderers'
import {
  LineChart
} from 'echarts/charts'
import {
  GridComponent,
  TitleComponent,
  TooltipComponent,
  LegendComponent
} from 'echarts/components'

use([
  CanvasRenderer,
  LineChart,
  GridComponent,
  TitleComponent,
  TooltipComponent,
  LegendComponent
])

const app = createApp(App)
app.component('v-chart', VChart)
app.use(router)
app.use(i18n)
app.mount('#app')

// Connexion (compte Google) puis réglages du profil en base : couleurs des types d'actifs, et mode clair / sombre
// pour un compte connecté. Les graphiques se recolorent dès leur arrivée.
startSession()

