import CommandBase from '@anycli/command'
import Help from '@anycli/plugin-help'
import cli from 'cli-ux'

import Engine from './engine'

export default class Command extends CommandBase {
  static type = 'engine'

  engine = new Engine()

  async run() {
    await this.engine.load(this.config)
    let id = this.argv[0]
    if (id === '-h' || this.argv.includes('--help')) return this.showHelp()
    if (!id) id = 'help'
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

  protected showHelp() {
    let id = this.argv.find(a => !a.startsWith('-'))
    const HHelp: typeof Help = require('@anycli/plugin-help').default
    let help = new HHelp(this.config)
    if (!id) {
      let rootHelp = help.root()
      cli.info(rootHelp)
    } else {
      let command = this.engine.findCommand(id, true)
      let commandHelp = help.command(command)
      cli.info(commandHelp)
    }
  }
}
