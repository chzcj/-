import { register } from 'node:module'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const stubUrl = pathToFileURL(path.join(process.cwd(), 'scripts/stubs/server-only.js'))

register('server-only', import.meta.url, (specifier, context, nextResolve) => {
  if (specifier === 'server-only') {
    return { url: stubUrl.href, shortCircuit: true, format: 'module' }
  }
  return nextResolve(specifier, context)
})
