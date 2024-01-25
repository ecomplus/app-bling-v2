const getAppData = require('./../../lib/store-api/get-app-data')
const blingAuth = require('../../lib/bling-auth/create-access')

exports.get = async ({ appSdk, admin }, req, res) => {
  console.log('>> GET  BLING')
  const { body, query } = req
  const { state, code } = query
  const storeId = parseInt(query.storeId, 10)
  console.log('>> Store: ', storeId, ' code: ', code, 'aplicativo', state, '<<')
  if (storeId > 100 && code) {
    return appSdk.getAuth(storeId)
      .then(async (auth) => {
        try {
          getAppData({ appSdk, storeId, auth })
            .then(async appData => {
              const { client_id, client_secret } = appData
              console.log('Pass variables', JSON.stringify({client_id, client_secret, code, storeId}))
              const bling = await blingAuth(client_id, client_secret, code, storeId)
              console.log('bling', bling)
              return res.status(200).redirect('https://app.e-com.plus/#/apps/edit/102418/')
              /* bling.get('/categorias/lojas')
                .then(() => {
                  console.log('deu certo a request de autenticação')
                  
                }) */
            })
        } catch (error) {
          console.error(error)
          const { response, config } = error
          let status
          if (response) {
            status = response.status
            const err = new Error(`#${storeId} Bling Webhook error ${status}`)
            err.url = config && config.url
            err.status = status
            err.response = JSON.stringify(response.data)
            console.error(err)
          }
          if (!res.headersSent) {
            res.status(500).redirect('https://app.e-com.plus/#/apps/edit/102418/')
          }
        }
      })
      .catch(() => {
        console.log('Unauthorized')
        if (!res.headersSent) {
          res.sendStatus(401)
        }
      })
  } else {
    return res.send({
      status: 404,
      msg: `StoreId #${storeId} not found`
    })
  }
}
