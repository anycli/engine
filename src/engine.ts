import {ICLIConfig, IEngine, IPlugin, ITopic} from '@dxcli/config'
import {ICachedCommand, load, Plugin} from '@dxcli/loader'
import cli from 'cli-ux'
import * as Rx from 'rxjs/Rx'

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

  async init(config: ICLIConfig) {
    this.config = config
    const plugins$ = this.fetchPlugins(config.pjson.plugins)
    const [plugins, commands, topics] = await Rx.Observable.forkJoin(
      plugins$.reduce((arr, plugin) => arr.concat(...[plugin]), []),
      plugins$.reduce((arr, plugin) => arr.concat(...plugin.commands), [] as ICachedCommand[]),
      plugins$.reduce((arr, plugin) => arr.concat(...plugin.topics), [] as ITopic[]),
    ).toPromise()
    this._plugins = plugins
    this._commands = commands
    this._topics = topics
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
        const result = await m(opts)
        if (result && result.exit) {
          // exit with code if it returns an object like
          // {exit: 1}
          cli.exit(result.exit)
        }
      } catch (err) {
        cli.warn(err)
      }
    })
    .toPromise()
  }

  private fetchPlugins(plugins: string | string[] | undefined): Rx.Observable<Plugin> {
    if (!plugins) return Rx.Observable.empty()
    let plugins$: Rx.Observable<Plugin>
    if (typeof plugins === 'string') {
      plugins$ = undefault(require(plugins))(this.config)
    } else {
      plugins$ = Rx.Observable.from(plugins)
    }
    return plugins$.expand(p => p.fetch
    .expand(p => this.subplugins(p))
    .share()
  }
}
