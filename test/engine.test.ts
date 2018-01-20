import {describe, expect, it, output} from '@dxcli/dev-test'

import {run} from '../src'

export interface RunCommandOptions {
  description?: string
  stdout?: string
  stderr?: string
  exit?: number
}
const itRunsCommand = (args: string[], opts: RunCommandOptions) => {
  const description = opts.description || args[0]
  let test = it
  if (opts.stdout) test = test.stdout
  if (opts.stderr) test = test.stderr
  test(description, async () => {
    const exit = opts.exit || 0
    try {
      await run(args)
    } catch (err) {
      if (err.code !== 'EEXIT') throw err
      if (err['cli-ux'].exitCode !== exit) {
        throw new Error(`Expected exit code to be ${exit} but got ${err['cli-ux'].exitCode}`)
      }
    }
    if (opts.stdout) expect(output.stdout).to.equal(opts.stdout)
    if (opts.stderr) expect(output.stderr).to.equal(opts.stderr)
  })
}

const pjson = require('../package.json')

describe('CLI', () => {
  describe('version', () => {
    const stdout = `@dxcli/engine/${pjson.version} (${process.platform}-${process.arch}) node-${process.version}\n`

    itRunsCommand(['--version'], {stdout})
    itRunsCommand(['-v'], {stdout})
    itRunsCommand(['version'], {stdout})
  })
})
