import {expect, fancy} from 'fancy-mocha'

import {run} from '../src'

const pjson = require('../package.json')

describe('CLI', () => {
  describe('version', () => {
    const stdout = `@dxcli/engine/${pjson.version} (${process.platform}-${process.arch}) node-${process.version}\n`

    fancy()
    .stdout()
    .run(() => run(['--version']))
    .catch((err: any) => expect(err['cli-ux'].exit).to.equal(0))
    .run(output => expect(output.stdout).to.equal(stdout))
    .end('--version')

    fancy()
    .stdout()
    .run(() => run(['-v']))
    .catch((err: any) => expect(err['cli-ux'].exit).to.equal(0))
    .run(output => expect(output.stdout).to.equal(stdout))
    .end('-v')

    fancy()
    .stdout()
    .run(() => run(['version']))
    .run(output => expect(output.stdout).to.equal(stdout))
    .end('version')
  })
})
