const blingAxios = require('./create-access')

class Bling {
  constructor (clientId, clientSecret, storeId) {
    if (!clientId && !clientSecret) {
      throw new Error('Missing clientId or clientSecret')
    }

    this.clientId = clientId
    this.clientSecret = clientSecret
    this.storeId = storeId
    this._bling = null
  }

  async get (url, opts) {
    if (!this._bling) {
      this._bling = await blingAxios(this.clientId, this.clientSecret, this.storeId)
    }

    return this._bling.get(url, opts)
      .catch(async (err) => {
        if (err.response?.data) {
          const errorType = err.response.data.error?.type
          if (errorType === 'TOO_MANY_REQUESTS') {
            this._bling = await blingAxios(this.clientId, this.clientSecret, this.storeId, true)
            return this._bling.get(url, opts)
          }
        }
        throw err
      })
  }

  async post (url, data, opts) {
    if (!this._bling) {
      this._bling = await blingAxios(this.clientId, this.clientSecret, this.storeId)
    }

    return this._bling.post(url, data, opts)
      .catch(async (err) => {
        if (err.response?.data) {
          const errorType = err.response.data.error?.type
          if (errorType === 'TOO_MANY_REQUESTS') {
            this._bling = await blingAxios(this.clientId, this.clientSecret, this.storeId, true)
            return this._bling.post(url, data, opts)
          }
        }
        throw err
      })
  }

  async patch (url, data, opts) {
    if (!this._bling) {
      this._bling = await blingAxios(this.clientId, this.clientSecret, this.storeId)
    }

    return this._bling.patch(url, data, opts)
      .catch(async (err) => {
        if (err.response?.data) {
          const errorType = err.response.data.error?.type
          if (errorType === 'TOO_MANY_REQUESTS') {
            this._bling = await blingAxios(this.clientId, this.clientSecret, this.storeId, true)
            return this._bling.patch(url, data, opts)
          }
        }
        throw err
      })
  }

  async put (url, data, opts) {
    if (!this._bling) {
      this._bling = await blingAxios(this.clientId, this.clientSecret, this.storeId)
    }

    return this._bling.put(url, data, opts)
      .catch(async (err) => {
        if (err.response?.data) {
          const errorType = err.response.data.error?.type
          if (errorType === 'TOO_MANY_REQUESTS') {
            this._bling = await blingAxios(this.clientId, this.clientSecret, this.storeId, true)
            return this._bling.put(url, data, opts)
          }
        }
        throw err
      })
  }

  async delete (url) {
    if (!this._bling) {
      this._bling = await blingAxios(this.clientId, this.clientSecret, this.storeId)
    }

    return this._bling.delete(url)
      .catch(async (err) => {
        if (err.response?.data) {
          const errorType = err.response.data.error?.type
          if (errorType === 'TOO_MANY_REQUESTS') {
            this._bling = await blingAxios(this.clientId, this.clientSecret, this.storeId, true)
            return this._bling.delete(url)
          }
        }
        throw err
      })
  }
}

module.exports = Bling
