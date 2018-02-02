import * as path from 'path'
import * as semver from 'semver'

function checkNodeVersion() {
  try {
    const root = path.join((module.parent && module.parent.filename) || __filename, '../..')
    const pjson = require(path.join(root, 'package.json'))
    const nodeVersion = process.versions.node
    const engine = pjson.engines && pjson.engines.node
    if (!engine) return
    if (!semver.satisfies(nodeVersion, engine)) {
      process.stderr.write(`WARNING\nWARNING Node version must be ${pjson.engines.node} to use ${pjson.name}\nWARNING\n`)
    }
  } catch {}
}
checkNodeVersion()

import * as Config from '@anycli/config'

import Command from './command'
import Engine from './engine'

export function run(argv = process.argv.slice(2), opts: Partial<Config.ICommandOptions> = {}) {
  return Command.run(argv, {root: module.parent!.filename, ...opts})
}

export default run
export {Engine}
