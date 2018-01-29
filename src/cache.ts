import ManifestFile from '@dxcli/manifest-file'

export default class PluginCache<T> extends ManifestFile {
  constructor(public file: string, public cacheKey: string, public name: string) {
    super(['@dxcli/load', name].join(':'), file)
    this.type = 'cache'
    this.debug('file: %s cacheKey: %s', this.file, this.cacheKey)
  }

  async fetch(key: string, fn: () => Promise<T>): Promise<T> {
    await this.lock.add('read')
    try {
      let [output, cacheKey] = await this.get(key, 'cache_key') as [T | undefined, string]
      if (cacheKey && cacheKey !== this.cacheKey) {
        await this.reset()
        output = undefined
      }
      if (output) return output
      this.debug('fetching', key)
      let input = await fn()
      try {
        await this.lock.add('write', {timeout: 200, reason: 'cache'})
        await this.set(['cache_key', this.cacheKey], [key, input])
        return input
      } catch (err) {
        this.debug(err)
        return input
      } finally {
        await this.lock.remove('write')
      }
    } finally {
      await this.lock.remove('read')
    }
  }
}
