const getAppData = require('./../../lib/store-api/get-app-data')
const Bling = require('../../lib/bling-auth/create-access')

exports.post = async ({ appSdk, admin }, req, res) => {
  console.log('>> POST  BLING')
  const { body, query } = req
  const { state, code } = query
  console.log('Query', JSON.stringify(query))
  const storeId = parseInt(query.storeId, 10)
  console.log('>> Store: ', storeId, ' code: ', code, '<<')
  if (storeId > 100 && code) {
    return appSdk.getAuth(storeId)
      .then(async (auth) => {
        try {
          getAppData({ appSdk, storeId, auth })
            .then(async appData => {
              const { client_id, client_secret } = appData
              console.log('Pass variables', JSON.stringify({client_id, client_secret, code, storeId}))
              await new Bling(client_id, client_secret, code, storeId)
              setTimeout(() => {
                return res.status(200).redirect('https://app.e-com.plus/#/apps/edit/102418/')
              }, 2000)
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
            res.send({
              status: status || 500,
              msg: `#${storeId} Bling Webhook error`
            })
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

exports.get = ({ appSdk, admin }, req, res) => {
  console.log('>> GET  BLING')
  const { body, query } = req
  const { state, code } = query
  console.log('Query', JSON.stringify(query))
  const storeId = parseInt(query.storeId, 10)
  console.log('>> Store: ', storeId, ' code: ', code, 'aplicativo', state, '<<')
  if (storeId > 100 && code) {
    return appSdk.getAuth(storeId)
      .then(async (auth) => {
        try {
          return getAppData({ appSdk, storeId, auth })
            .then(async appData => {
              const { client_id, client_secret } = appData
              console.log('Pass variables', JSON.stringify({client_id, client_secret, code, storeId}))
              await new Bling(client_id, client_secret, code, storeId)
              setTimeout(() => {
                return res.status(200).redirect('https://app.e-com.plus/#/apps/edit/102418/')
              }, 2000)
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
            res.send({
              status: status || 500,
              msg: `#${storeId} Bling Webhook error`
            })
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
