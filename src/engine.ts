import {ICachedCommand, ICLIConfig, IEngine, ITopic} from '@dxcli/config'
import {load, Plugin} from '@dxcli/loader'
import cli from 'cli-ux'
import * as Rx from 'rxjs'

import {undefault} from './util'

export default class Engine implements IEngine {
  public config: ICLIConfig
  private _plugins: Plugin[]
  private _topics: ITopic[]
  private _commands: ICachedCommand[]

  get plugins(): Plugin[] { return this._plugins }
  get topics(): ITopic[] { return this._topics }
  get commands(): ICachedCommand[] { return this._commands }
  get commandIDs(): string[] { return this.commands.map(c => c.id) }
  get rootTopics(): ITopic[] { return this._topics.filter(t => !t.name.includes(':')) }
  get rootCommands(): ICachedCommand[] { return this.commands.filter(c => !c.id.includes(':')) }

  async load(root: string) {
    const results = await load({root, type: 'core'})
    results.config.engine = this
    this.config = results.config as any
    this._plugins = results.plugins
    this._commands = results.commands
    this._topics = results.topics
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

  runHook<T extends {}>(event: string, opts: T): Promise<void> {
    return Rx.Observable.from(this.plugins)
    .mergeMap(p => p.config.hooks[event] || [])
    .mergeMap(async hook => {
      try {
        const m = await undefault(require(hook))
        await m({...opts as any || {}, config: this.config})
      } catch (err) {
        if (err.code === 'EEXIT') throw err
        cli.warn(err, ['hook', event, hook])
      }
    })
    .toPromise()
  }
}
