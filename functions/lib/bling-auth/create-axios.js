const axios = require('axios')

module.exports = (clientId, clientSecret) => {
  const headers = {
    Accept: '1.0'
  }
  
  const baseURL = 'https://www.bling.com.br/Api/v3/'

  if (clientId && clientSecret) {
    console.log('> client id ', clientId, '>> client secret', clientSecret)
    headers.Authorization = 'Basic ' +
    Buffer.from(`${clientId}:${clientSecret}`, 'utf8').toString('base64')
  }

  return axios.create({
    baseURL,
    timeout: 6000,
    headers
  })
}
