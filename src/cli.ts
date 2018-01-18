import Command from '@dxcli/command'
import {CLIConfig} from '@dxcli/config'
import cli from 'cli-ux'

import Engine from './engine'

export class CLI extends Command {
  // skip flag parser
  async init() {}

  async run() {
    const engine = new Engine()
    const config = CLIConfig.create({engine, root: module.parent!.id})
    console.dir(config)
  }
}
