// Tables inventées, au format de GET /api/data/<onglet>/. Chaque appel renvoie une copie : un test peut la modifier
// sans toucher aux autres.
import portfolio from './portfolio.json'
import history from './history.json'
import inout from './inout.json'

export const portfolioTable = () => structuredClone(portfolio)
export const historyTable = () => structuredClone(history)
export const inoutTable = () => structuredClone(inout)
