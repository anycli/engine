import {expect, fancy} from 'fancy-test'

import {run} from '../src'

const pjson = require('../package.json')

describe('CLI', () => {
  describe('version', () => {
    const stdout = `@anycli/engine/${pjson.version} (${process.platform}-${process.arch}) node-${process.version}\n`

    fancy
    .stdout()
    .do(() => run(['--version']))
    .catch((err: any) => expect(err['cli-ux'].exit).to.equal(0))
    .do(output => expect(output.stdout).to.equal(stdout))
    .it('--version')

    fancy
    .stdout()
    .do(() => run(['-v']))
    .catch((err: any) => expect(err['cli-ux'].exit).to.equal(0))
    .do(output => expect(output.stdout).to.equal(stdout))
    .end('-v')

    fancy
    .stdout()
    .do(() => run(['version']))
    .do(output => expect(output.stdout).to.equal(stdout))
    .it('version')
  })
})
