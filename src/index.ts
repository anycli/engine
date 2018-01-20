import CommandBase from '@dxcli/command'
import {ICLIConfig, ICommandOptions, IEngine} from '@dxcli/config'
import cli from 'cli-ux'

import Engine from './engine'

class Command extends CommandBase {
  config: ICLIConfig
  engine: IEngine

  async run() {
    cli.config.errlog = this.config.errlog
    const id = this.argv[0]
    await this.engine.runHook('init', {id})
    const cachedCommand = this.engine.findCommand(id)
    if (!cachedCommand) return this.commandNotFound(id)
    const command = await cachedCommand.load()
    await command.run(this.argv.slice(1), {config: this.config})
  }

  protected async init(argv: string[], opts: ICommandOptions & {root: string}) {
    const root = opts.root || module.parent!.filename
    this.argv = argv
    this.engine = new Engine()
    await this.engine.load(root)
    this.config = this.engine.config
  }

  protected async commandNotFound(id: string) {
    await this.engine.runHook('command_not_found', {id})
    throw new Error(`command not found: ${id}`)
  }
}

export function run(argv = process.argv.slice(2), opts: ICommandOptions = {}) {
  return Command.run(argv, opts)
}

export default run
export {Engine}
