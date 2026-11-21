// Calcul de la simulation hors du fil principal : la page reste fluide pendant les 5 000 tirages.
import { simulate } from './simulation.js'

self.onmessage = (event) => {
  const { id, params } = event.data
  try {
    const result = simulate(params)
    self.postMessage({ id, result: { years: result.years, goalChance: result.goalChance, ruin: result.ruin, runs: result.runs } })
  } catch (error) {
    self.postMessage({ id, error: error?.message ?? String(error) })
  }
}
