const url = require('url')

module.exports = (client_id, client_secret, code, storeId, refresh_token) => new Promise((resolve, reject) => {
  //  https://developer.bling.com.br/aplicativos#fluxo-de-autoriza%C3%A7%C3%A3o
  const axios = require('./create-axios')(undefined, client_id, client_secret)
  const request = isRetry => {
    const path = '/oauth/token'
    console.log(`>> Create Auth path:${storeId}: ${path} - ${refresh_token}`)
    const grandType = {
      grant_type: refresh_token ? 'refresh_token' : 'authorization_code'
    }
    if (refresh_token) {
      grandType['refresh_token'] = refresh_token
    } else if (code) {
      grandType['code'] = code
    }
    const params = new url.URLSearchParams(grandType)
    console.log('path', path, 'params', JSON.stringify(params))
    axios.post(path, params.toString())
      .then(({ data }) => resolve(data))
      .catch(err => {
        console.log('Deu erro', JSON.stringify(err))
        // console.log('Deu erro quero response status', err.response.status)
        if (!isRetry && err.response && err.response.status >= 429) {
          setTimeout(() => request(true), 7000)
        }
        reject(err)
      })
  }
  request()
})
