import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createApp } from './app.ts'

function argumentValue(name: string): string | undefined {
  const prefix = `--${name}=`
  const match = process.argv.find((argument) => argument.startsWith(prefix))
  return match ? match.slice(prefix.length) : undefined
}

function booleanFlag(name: string): boolean {
  return process.argv.includes(`--${name}`)
}

async function main(): Promise<void> {
  const port = Number(
    argumentValue('port') ?? process.env.PORT ?? '8787',
  )
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('El puerto debe ser un número entre 1 y 65535.')
  }

  const host = argumentValue('host') ?? process.env.HOST ?? '127.0.0.1'
  const dataDirectory = resolve(
    argumentValue('data-dir') ??
      process.env.DATA_DIR ??
      join(process.cwd(), 'data'),
  )
  const dataFile = resolve(
    process.env.DATA_FILE ?? join(dataDirectory, 'dialista.json'),
  )
  const serveStatic =
    booleanFlag('serve-static') ||
    process.env.SERVE_STATIC === 'true'
  const staticDirectory = resolve(
    argumentValue('static-dir') ??
      process.env.STATIC_DIR ??
      join(process.cwd(), 'dist'),
  )
  const sessionDays = Number(process.env.SESSION_DAYS ?? '30')
  const sessionTtlMs =
    (Number.isFinite(sessionDays) && sessionDays > 0 ? sessionDays : 30) *
    24 *
    60 *
    60 *
    1000

  if (serveStatic && !existsSync(join(staticDirectory, 'index.html'))) {
    throw new Error(
      `No se encuentra el build del cliente en ${staticDirectory}. Ejecuta «npm run build» antes de arrancar en producción.`,
    )
  }

  const { app } = await createApp({
    dataFile,
    staticDir: serveStatic ? staticDirectory : null,
    sessionTtlMs,
    secureCookies: process.env.COOKIE_SECURE === 'true',
    trustProxy: process.env.TRUST_PROXY === 'true',
    bodyLimit: process.env.BODY_LIMIT ?? '5mb',
    authRateLimit:
      process.env.AUTH_RATE_LIMIT === 'off'
        ? false
        : {
            max: Number(process.env.AUTH_RATE_LIMIT ?? '30'),
            windowMs: 10 * 60 * 1000,
          },
  })

  const server = app.listen(port, host, () => {
    console.log(`DíaLista API: http://${host}:${port}`)
    console.log(
      serveStatic
        ? `Interfaz servida desde ${staticDirectory}`
        : 'Modo desarrollo: la interfaz se sirve con Vite y /api se redirige aquí.',
    )
    console.log(`Datos: ${dataFile}`)
  })

  server.on('error', (error) => {
    console.error('No se ha podido arrancar el servidor:', error)
    process.exitCode = 1
  })

  let shuttingDown = false
  const shutdown = (signal: string) => {
    if (shuttingDown) return
    shuttingDown = true
    console.log(`\nCerrando DíaLista (${signal})…`)
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(1), 5000).unref()
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : 'Error al arrancar DíaLista.',
  )
  process.exitCode = 1
})
