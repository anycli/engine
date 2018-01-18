import {describe, expect, it, output} from '@dxcli/dev-test'

import {CLI} from '../src/cli'

describe.stdout('CLI', () => {
  it('--version', async () => {
    await CLI.run([])
    expect(output.stdout).to.equal('foo\n')
  })
})
