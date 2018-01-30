import {IEngine, read} from '@dxcli/config'
import {expect, fancy} from 'fancy-test'
import * as fs from 'fs-extra'
import * as path from 'path'

import {Engine} from '../src'

const loadPlugin = (root: string) => async (ctx: {engine: IEngine}) => {
  await reset(root)
  const config = await read({root})
  ctx.engine = new Engine()
  await ctx.engine.load(config)
}

const reset = async (root: string) => {
  await fs.outputFile(path.join(root, '.git'), '')
  const config = await read({root})
  await fs.remove(config.cacheDir)
  await fs.remove(config.dataDir)
}

describe('hooks', () => {
  fancy
  .stdout()
  .do(loadPlugin(path.join(__dirname, 'fixtures/typescript')))
  .do(async ctx => {
    const cmd = await ctx.engine.commands[0].load()
    await cmd.run([])
    expect(ctx.stdout).to.equal('loading plugins\nit works!\n')
  })
  .it('loads a TS plugin')

  fancy
  .stdout()
  .do(loadPlugin(path.join(__dirname, 'fixtures/typescript2')))
  .do(async ctx => {
    const cmd = await ctx.engine.commands[0].load()
    await cmd.run([])
    expect(ctx.stdout).to.equal('loading plugins\nit works 2!\n')
  })
  .it('loads 2 TS plugins')
})
