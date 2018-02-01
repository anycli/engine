import CommandBase from '@anycli/command'

import Engine from './engine'

export default class Command extends CommandBase {
  engine = new Engine()

  async run() {
    await this.engine.load(this.config)
    let id = this.argv[0]
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
}
