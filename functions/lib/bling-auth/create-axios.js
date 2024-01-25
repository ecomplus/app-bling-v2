const axios = require('axios')

module.exports = (accessToken, clientId, clientSecret) => {
  let headers = {
    Accept: '1.0'
  }
  
  const baseURL = 'https://www.bling.com.br/Api/v3/'
  if (accessToken) {
    console.log('> token ', accessToken)
    headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`
    }
  } else if (clientId && clientSecret) {
    console.log('> client id ', clientId, '>> client secret', clientSecret)
    headers.Authorization = 'Basic ' +
    Buffer.from(`${clientId}:${clientSecret}`, 'utf8').toString('base64')
  }

  return axios.create({
    baseURL,
    timeout: 10000,
    headers
  })
}
