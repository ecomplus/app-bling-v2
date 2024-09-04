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

  async checkTime (url) {
    return new Promise(resolve => {
      const now = new Date()
      if (!this.last_request) {
        this.last_request = now
        resolve(true)
      } else {
        const timeout = now.getTime() - this.last_request.getTime()
        if (timeout >= 1000) {
          this.last_request = now
          resolve(true)
        } else {
          setTimeout(() => {
            this.last_request = new Date()
            resolve(true)
          }, 1000 - timeout)
        }
      }
    })
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
            this._bling = await blingAxios(this.clientId, this.clientSecret, this.storeId, timeForce, isDailyRateLimitError)
            return this._bling.delete(url)
          }
        }
        throw err
      })
  }
}

module.exports = Bling
