import {convertToCached} from '@anycli/command'
import {ICachedCommand, ICommand, IConfig, IEngine, IPlugin, ITopic, read} from '@anycli/config'
import cli from 'cli-ux'
import * as fs from 'fs-extra'
import * as globby from 'globby'
import * as _ from 'lodash'
import * as path from 'path'

import Cache from './cache'
import {registerTSNode} from './typescript'
import {undefault} from './util'

export default class Engine implements IEngine {
  public config!: IConfig
  private _plugins!: IPlugin[]
  private readonly _commands: ICachedCommand[] = []
  private readonly _topics: ITopic[] = []
  private readonly _hooks: {[k: string]: string[]} = {}
  private rootPlugin!: IPlugin
  private debug: any

  get plugins(): IPlugin[] { return this._plugins }
  get topics(): ITopic[] { return this._topics }
  get commands(): ICachedCommand[] { return this._commands }
  get commandIDs(): string[] { return _(this.commands).map(c => c.id).uniq().value() }
  get rootTopics(): ITopic[] { return this.topics.filter(t => !t.name.includes(':')) }
  get rootCommands(): ICachedCommand[] { return this.commands.filter(c => !c.id.includes(':')) }

  async load(config: IConfig) {
    this.config = config
    this.config.engine = this

    // set global config for plugins to use in any part of their loading
    if (!global.anycli) global.anycli = {} as any
    if (!global.anycli.config) global.anycli.config = this.config

    this.debug = require('debug')(['@anycli/engine', this.config.name].join(':'))

    const loadPlugin = async (opts: {root: string, type: string, config?: IConfig, name?: string, tag?: string, loadDevPlugins?: boolean}) => {
      this.debug('loading plugin', opts.name || opts.root)
      const config = opts.config || await read(opts)
      const pjson = config.pjson
      const name = pjson.name
      const version = pjson.version
      const type = opts.type || 'core'

      const plugin: IPlugin = {
        name,
        version,
        root: config.root,
        tag: opts.tag,
        type,
        config,
        hooks: config.hooksTS || config.hooks,
        commands: [],
        topics: [],
        plugins: [],
      }

      if (config.pluginsModuleTS || config.hooksTS || config.commandsDirTS) {
        registerTSNode(this.debug, config.root)
      }

      if (opts.loadDevPlugins && _.isArray(config.pjson.anycli.devPlugins)) {
        const devPlugins = config.pjson.anycli.devPlugins
        this.debug('loading dev plugins', devPlugins)
        const promises = devPlugins.map(p => loadPlugin({root: config.root, type: 'dev', name: p}).catch(cli.warn))
        plugin.plugins.push(..._(await Promise.all(promises)).compact().flatMap().value() as IPlugin[])
      }

      if (config.pluginsModule) {
        try {
          let roots
          let fetch = (d: string) => undefault(require(d))(this.config)
          if (config.pluginsModuleTS) {
            try {
              roots = await fetch(config.pluginsModuleTS)
            } catch (err) {
              cli.warn(err)
            }
          }
          if (!roots) roots = await fetch(config.pluginsModule)
          const promises = roots.map((r: any) => loadPlugin(r).catch(cli.warn))
          plugin.plugins.push(...await Promise.all(promises) as any)
        } catch (err) {
          cli.warn(err)
        }
      }
      if (_.isArray(pjson.anycli.plugins)) {
        const promises = pjson.anycli.plugins.map(p => loadPlugin({root: config.root, type, name: p}).catch(cli.warn))
        plugin.plugins.push(..._(await Promise.all(promises)).compact().flatMap().value() as IPlugin[])
      }

      return plugin
    }
    this.rootPlugin = await loadPlugin({type: 'core', root: config.root, loadDevPlugins: true})

    function getAllPlugins(plugin: IPlugin): IPlugin[] {
      let plugins = [plugin]
      for (let p of plugin.plugins || []) {
        plugins.push(...getAllPlugins(p))
      }
      return plugins
    }
    this._plugins = getAllPlugins(this.rootPlugin)

    await this.runHook('legacy', {engine: this})

    // add hooks and topics
    for (let p of this._plugins) {
      for (let [hook, hooks] of Object.entries(p.hooks)) {
        this._hooks[hook] = [...this._hooks[hook] || [], ...hooks]
      }
      this._topics.push(...p.topics)
    }

    this._commands.push(..._(
      await Promise.all(this.plugins.map(p => this.getPluginCommands(p, true)))
    ).flatMap().value())

    // add missing topics from commands
    for (let c of this._commands) {
      let name = c.id!.split(':').slice(0, -1).join(':')
      if (!this.topics.find(t => t.name === name)) {
        this.topics.push({name})
      }
    }
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

  async getPluginCommands(plugin: IPlugin, useCache = false): Promise<ICachedCommand[]> {
    function getCached(c: ICommand): ICachedCommand {
      const opts = {plugin}
      if (c.convertToCached) return c.convertToCached(opts)
      return convertToCached(c, opts)
    }

    const getLastUpdated = async (): Promise<Date | undefined> => {
      try {
        // if (!await fs.pathExists(path.join(plugin.root, '.git'))) return
        let files = await globby([`${plugin.root}/+(src|lib)/**/*.+(js|ts)`, '!**/*.+(d.ts|test.ts|test.js)'])
        let stats = await Promise.all(files.map(async f => {
          const stat = await fs.stat(f)
          return [f, stat] as [string, fs.Stats]
        }))
        const max = _.maxBy(stats, '[1].mtime')
        if (!max) return new Date()
        this.debug('most recently updated file: %s %o', max[0], max[1].mtime)
        return max[1].mtime
      } catch (err) {
        cli.warn(err)
        return new Date()
      }
    }
    const lastUpdated = await getLastUpdated()

    const debug = require('debug')(['@anycli/load', plugin.name].join(':'))

    const fetchFromDir = async (dir: string) => {
      function findCommand(id: string): ICommand {
        function commandPath(id: string): string {
          return require.resolve(path.join(dir, ...id.split(':')))
        }
        debug('fetching %s from %s', id, dir)
        const p = commandPath(id)
        let c = undefault(require(p))
        c.id = id
        return c
      }

      const fetch = async (): Promise<ICachedCommand[]> => {
        const fetchCommandIDs = async (): Promise<string[]> => {
          function idFromPath(file: string) {
            const p = path.parse(file)
            const topics = p.dir.split('/')
            let command = p.name !== 'index' && p.name
            return _([...topics, command]).compact().join(':')
          }

          debug(`loading IDs from ${dir}`)
          const files = await globby(['**/*.+(js|ts)', '!**/*.+(d.ts|test.ts|test.js)'], {cwd: dir})
          let ids = files.map(idFromPath)
          debug('commandIDs dir: %s ids: %s', dir, ids.join(' '))
          return ids
        }
        const commands = (await fetchCommandIDs())
          .map(id => {
            try {
              const cmd = findCommand(id)
              return getCached(cmd)
            } catch (err) { cli.warn(err) }
          })
        return _.compact(commands)
      }

      const rehydrate = (commands: ICachedCommand[]): ICachedCommand[] => {
        return commands.map((cmd: ICachedCommand): ICachedCommand => ({
          ...cmd,
          load: async () => findCommand(cmd.id),
        }))
      }

      let commands
      if (useCache) {
        const cacheFile = path.join(this.config.cacheDir, 'commands', plugin.type, `${plugin.name}.json`)
        let cacheKey = [this.config.version, plugin.version]
        if (lastUpdated) cacheKey.push(lastUpdated.toISOString())
        const cache = new Cache<ICachedCommand[]>(cacheFile, cacheKey.join(':'), plugin.name)
        commands = await cache.fetch('commands', fetch)
      } else {
        commands = await fetch()
      }
      return rehydrate(commands)
    }

    let commands: ICachedCommand[] = []
    if (plugin.config.commandsDirTS) {
      try {
        commands.push(...await fetchFromDir(plugin.config.commandsDirTS))
      } catch (err) {
        cli.warn(err)
        // debug(err)
      }
    } else if (plugin.config.commandsDir) {
      commands.push(...await fetchFromDir(plugin.config.commandsDir))
    }
    return commands
  }
}
