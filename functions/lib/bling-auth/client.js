const blingAxios = require('./create-access')
// https://developer.bling.com.br/limites#filtros
const timeForce = 18000 * 1000
class Bling {
  constructor (clientId, clientSecret, storeId) {
    if (!clientId && !clientSecret) {
      throw new Error('Missing clientId or clientSecret')
    }

    this.clientId = clientId
    this.clientSecret = clientSecret
    this.storeId = storeId
    this._bling = null
    this.last_request = null
  }

  async delay (timeout) {
    return new Promise((resolve) => {
      setTimeout(() => resolve(true), timeout)
    })
  }

  async checkTime (url) {
    const now = new Date()
    if (!this.last_request) {
      this.last_request = now
      return true
    }
    const timeout = now.getTime() - this.last_request.getTime()
    if (timeout >= 1000) {
      this.last_request = new Date()
      return true
    }
    await this.delay(1000 - timeout)
    this.last_request = new Date()
    return true
  }

  async get (url, opts) {
    await this.checkTime(url)
    if (!this._bling) {
      this._bling = await blingAxios(this.clientId, this.clientSecret, this.storeId)
    }

    return this._bling.get(url, opts)
      .catch(async (err) => {
        if (err.response?.data) {
          const errorType = err.response.data.error?.type
          if (errorType === 'TOO_MANY_REQUESTS') {
            const isDailyRateLimitError = Boolean(err.response.data.error?.description?.includes('diário'))
            if (!isDailyRateLimitError) {
              await this.delay(1000)
              return this._bling.get(url, opts)
            }
            this._bling = await blingAxios(this.clientId, this.clientSecret, this.storeId, timeForce, isDailyRateLimitError)
            return this._bling.get(url, opts)
          }
        }
        throw err
      })
  }

  async post (url, data, opts) {
    await this.checkTime(url)
    if (!this._bling) {
      this._bling = await blingAxios(this.clientId, this.clientSecret, this.storeId)
    }

    return this._bling.post(url, data, opts)
      .catch(async (err) => {
        if (err.response?.data) {
          const errorType = err.response.data.error?.type
          if (errorType === 'TOO_MANY_REQUESTS') {
            const isDailyRateLimitError = Boolean(err.response.data.error?.description?.includes('diário'))
            if (!isDailyRateLimitError) {
              await this.delay(1000)
              return this._bling.post(url, data, opts)
            }
            this._bling = await blingAxios(this.clientId, this.clientSecret, this.storeId, timeForce, isDailyRateLimitError)
            return this._bling.post(url, data, opts)
          }
        }
        throw err
      })
  }

  async patch (url, data, opts) {
    await this.checkTime(url)
    if (!this._bling) {
      this._bling = await blingAxios(this.clientId, this.clientSecret, this.storeId)
    }

    return this._bling.patch(url, data, opts)
      .catch(async (err) => {
        if (err.response?.data) {
          const errorType = err.response.data.error?.type
          if (errorType === 'TOO_MANY_REQUESTS') {
            const isDailyRateLimitError = Boolean(err.response.data.error?.description?.includes('diário'))
            if (!isDailyRateLimitError) {
              await this.delay(1000)
              return this._bling.patch(url, data, opts)
            }
            this._bling = await blingAxios(this.clientId, this.clientSecret, this.storeId, timeForce, isDailyRateLimitError)
            return this._bling.patch(url, data, opts)
          }
        }
        throw err
      })
  }

  async put (url, data, opts) {
    await this.checkTime(url)
    if (!this._bling) {
      this._bling = await blingAxios(this.clientId, this.clientSecret, this.storeId)
    }

    return this._bling.put(url, data, opts)
      .catch(async (err) => {
        if (err.response?.data) {
          const errorType = err.response.data.error?.type
          if (errorType === 'TOO_MANY_REQUESTS') {
            const isDailyRateLimitError = Boolean(err.response.data.error?.description?.includes('diário'))
            if (!isDailyRateLimitError) {
              await this.delay(1000)
              return this._bling.put(url, data, opts)
            }
            this._bling = await blingAxios(this.clientId, this.clientSecret, this.storeId, timeForce, isDailyRateLimitError)
            return this._bling.put(url, data, opts)
          }
        }
        throw err
      })
  }

  async delete (url) {
    await this.checkTime(url)
    if (!this._bling) {
      this._bling = await blingAxios(this.clientId, this.clientSecret, this.storeId)
    }

    return this._bling.delete(url)
      .catch(async (err) => {
        if (err.response?.data) {
          const errorType = err.response.data.error?.type
          if (errorType === 'TOO_MANY_REQUESTS') {
            const isDailyRateLimitError = Boolean(err.response.data.error?.description?.includes('diário'))
            if (!isDailyRateLimitError) {
              await this.delay(1000)
              return this._bling.delete(url)
            }
            this._bling = await blingAxios(this.clientId, this.clientSecret, this.storeId, timeForce, isDailyRateLimitError)
            return this._bling.delete(url)
          }
        }
        throw err
      })
  }
}

module.exports = Bling
