import { app } from './routes'
import { ensureCacheTable, clearExpiredCache } from './cache'

ensureCacheTable().catch(console.error)
clearExpiredCache().catch(console.error)

app.listen(parseInt(process.env["PORT"] || "3111"), ({ port }) => {
  console.log(`Dev server is running at http://localhost:${port}`)
})