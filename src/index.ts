import {ICommandOptions} from '@dxcli/config'

import Engine from './engine'

export function run(argv = process.argv.slice(2), opts: ICommandOptions = {}) {
  opts.root = opts.root || module.parent!.filename
  return Engine.run(argv, opts)
}

export default run
export {Engine}
