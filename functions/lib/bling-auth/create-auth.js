const url = require('url')

module.exports = (clientId, clientSecret, code, storeId, refreshToken) => new Promise((resolve, reject) => {
  //  https://developer.bling.com.br/aplicativos#fluxo-de-autoriza%C3%A7%C3%A3o
  const axios = require('./create-axios')(undefined, clientId, clientSecret)
  const request = isRetry => {
    const path = '/oauth/token'
    console.log(`>> Create Auth with ${refreshToken ? 'refresh_token' : 'code'}`)
    const grandType = {
      grant_type: refreshToken ? 'refresh_token' : 'authorization_code'
    }
    if (refreshToken) {
      grandType.refresh_token = refreshToken
    } else if (code) {
      grandType.code = code
    }
    const params = new url.URLSearchParams(grandType)
    axios.post(path, params.toString())
      .then(({ data }) => resolve(data))
      .catch(err => {
        console.error(err.response?.data || err)
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
