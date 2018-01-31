import * as Config from '@anycli/config'

import Command from './command'
import Engine from './engine'

export function run(argv = process.argv.slice(2), opts: Config.ICommandOptions = {}) {
  return Command.run(argv, opts)
}

export default run
export {Engine}
