import cli from 'cli-ux'
import * as TSNode from 'ts-node'

const rootDirs: string[] = []
const typeRoots = [`${__dirname}/../node_modules/@types`]

export function registerTSNode(debug: any, root: string) {
  try {
    debug('registering ts-node at', root)
    const tsNode: typeof TSNode = require('ts-node')
    typeRoots.push(`${root}/../node_modules/@types`)
    rootDirs.push(`${root}/src`)
    tsNode.register({
      project: false,
      // cache: false,
      // typeCheck: true,
      compilerOptions: {
        target: 'esnext',
        module: 'commonjs',
        rootDirs,
        typeRoots,
      }
    })
  } catch (err) {
    cli.warn(err)
  }
}
