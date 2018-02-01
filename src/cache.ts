import ManifestFile from '@anycli/manifest-file'

export default class PluginCache<T> extends ManifestFile {
  skipIfLocked = true
  type = 'cache'

  constructor(public file: string, public cacheKey: string, public name: string) {
    super(['@anycli/load', name].join(':'), file)
    this.debug('file: %s cacheKey: %s', this.file, this.cacheKey)
  }

  async fetch(key: string, fn: () => Promise<T>): Promise<T> {
    if (!await this.addLock('read', `fetch:read ${key}`)) return fn()
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
        if (await this.addLock('write', `fetch:write ${key}`)) {
          await this.set(['cache_key', this.cacheKey], [key, input])
        }
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
