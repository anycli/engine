import CommandBase from '@anycli/command'
import * as Config from '@anycli/config'

import Engine from './engine'

export default class Command extends CommandBase {
  static parse = false

  static async run(argv = process.argv.slice(2), opts: Config.IConfig | Config.ConfigOptions = {}) {
    let cmd!: Command
    try {
      let config
      if (Config.isIConfig(opts)) config = opts
      else config = await Config.read({root: opts.root || module.parent!.parent!.filename})
      cmd = new this(argv, config)
      return await cmd.run()
    } finally {
      if (cmd) await cmd.finally()
    }
  }

  engine: Config.IEngine

  constructor(argv: string[], config: Config.IConfig) {
    super(argv, config)
    this.engine = this.config.engine = new Engine()
  }

  async run() {
    await this.engine.load(this.config)
    const id = this.argv[0]
    await this.engine.runHook('init', {id})
    const cachedCommand = this.engine.findCommand(id)
    if (!cachedCommand) return this.commandNotFound(id)
    this.debug('found command', cachedCommand.id)
    const command = await cachedCommand.load()
    this.debug('loaded command', command.id)
    await command.run(this.argv.slice(1), {config: this.config})
  }

  protected async commandNotFound(id: string) {
    await this.engine.runHook('command_not_found', {id})
    throw new Error(`command not found: ${id}`)
  }
}
