import {ICachedCommand, ICLIConfig, IEngine, IPlugin, ITopic} from '@dxcli/config'
import {load} from '@dxcli/loader'
import cli from 'cli-ux'

import {undefault} from './util'

export default class Engine implements IEngine {
  private _config: ICLIConfig
  private _plugins: IPlugin[]
  private _topics: ITopic[]
  private _commands: ICachedCommand[]
  private _hooks: {[k: string]: string[]}
  private debug: any

  public get config() { return this._config}
  public set config(c) {
    this._config = c
    this.debug = require('debug')(['@dxcli/engine', this._config.name].join(':'))
  }
  get plugins(): IPlugin[] { return this._plugins }
  get topics(): ITopic[] { return this._topics }
  get commands(): ICachedCommand[] { return this._commands }
  get commandIDs(): string[] { return this.commands.map(c => c.id) }
  get rootTopics(): ITopic[] { return this._topics.filter(t => !t.name.includes(':')) }
  get rootCommands(): ICachedCommand[] { return this.commands.filter(c => !c.id.includes(':')) }

  async load(rootOrConfig: string | ICLIConfig) {
    let results
    if (typeof rootOrConfig === 'string') {
      results = await load({root: rootOrConfig, type: 'core'})
      this.config = results.config as any
    } else {
      this.config = rootOrConfig
      results = await load({config: rootOrConfig, root: rootOrConfig.root, type: 'core'})
    }
    this._plugins = results.plugins
    this._commands = results.commands
    this._topics = results.topics
    this._hooks = results.hooks
  }

  findCommand(id: string, must: true): ICachedCommand
  findCommand(id: string, must?: true): ICachedCommand | undefined
  findCommand(id: string, must?: boolean): ICachedCommand | undefined {
    const cmd = this.commands.find(c => c.id === id)
    if (!cmd && must) throw new Error(`command ${id} not found`)
    return cmd
  }

  findTopic(name: string, must: true): ITopic
  findTopic(name: string, must?: boolean): ITopic | undefined
  findTopic(name: string, must?: boolean): ITopic | undefined {
    const topic = this.topics.find(t => t.name === name)
    if (!topic && must) throw new Error(`command ${name} not found`)
    return topic
  }

  async runHook<T extends {}>(event: string, opts: T) {
    this.debug('starting hook', event)
    await Promise.all((this._hooks[event] || [])
    .map(async hook => {
      try {
        this.debug('running hook', event, hook)
        const m = await undefault(require(hook))
        await m({...opts as any || {}, config: this.config})
      } catch (err) {
        if (err.code === 'EEXIT') throw err
        cli.warn(err, {context: {hook: event, module: hook}})
      }
    }))
    this.debug('finished hook', event)
  }
}
