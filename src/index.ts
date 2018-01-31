import * as Config from '@anycli/config'

import Command from './command'
import Engine from './engine'

export function run(argv = process.argv.slice(2), opts: Partial<Config.ICommandOptions> = {}) {
  return Command.run(argv, {root: module.parent!.filename, ...opts})
}

export default run
export {Engine}
