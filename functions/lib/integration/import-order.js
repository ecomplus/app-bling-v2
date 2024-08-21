const { firestore } = require('firebase-admin')
const { logger } = require('./../../context')
const Bling = require('../bling-auth/client')
const parseOrder = require('./parsers/order-to-ecomplus/')
const parseStatus = require('./parsers/order-to-ecomplus/status')
const handleJob = require('./handle-job')

const getLastStatus = records => {
  let statusRecord
  records.forEach(record => {
    if (record && (!statusRecord || !record.date_time || record.date_time >= statusRecord.date_time)) {
      statusRecord = record
    }
  })
  return statusRecord && statusRecord.status
}

module.exports = async ({ appSdk, storeId, auth }, blingStore, blingDeposit, queueEntry, appData) => {
  const blingOrderNumber = queueEntry.nextId
  const {
    client_id: clientId,
    client_secret: clientSecret
  } = appData
  const bling = new Bling(clientId, clientSecret, storeId)

  const job = bling.get(`/pedido/${blingOrderNumber}`)
    .then(({ data }) => {
      let blingOrder = data.pedidos.find(({ pedido }) => {
        return !blingStore || (String(blingStore) === String(pedido.loja))
      })
      if (!blingOrder) {
        return null
      }
      blingOrder = blingOrder.pedido
      logger.info(`#${storeId} found order ${blingOrder.numero}`)

      const situacao = typeof blingOrder.situacao === 'string'
        ? blingOrder.situacao.toLowerCase()
        : null

      const documentRef = firestore().doc(`bling_orders/${storeId}_${blingOrderNumber}`)
      return documentRef.get().then(documentSnapshot => {
        if (
          documentSnapshot.exists &&
          documentSnapshot.get('situacao') === situacao
        ) {
          logger.info(`>> Ignoring Bling order #${blingOrderNumber} with same status`)
          return null
        }

        const listEndpoint = '/orders.json?limit=1&fields=_id,payments_history,fulfillments,shipping_lines' +
          `&number=${(blingOrder.numeroPedidoLoja || blingOrder.numero)}`
        return appSdk.apiRequest(storeId, listEndpoint, 'GET', null, auth)

          .then(({ response }) => {
            const { result } = response.data
            if (!result.length) {
              return null
            }
            const order = result[0]
            return parseOrder(blingOrder, order.shipping_lines, bling, storeId).then(partialOrder => {
              const promises = []
              if (partialOrder && Object.keys(partialOrder).length) {
                promises.push(appSdk
                  .apiRequest(storeId, `/orders/${order._id}.json`, 'PATCH', partialOrder, auth))
              }

              const { fulfillmentStatus, financialStatus } = parseStatus(situacao)
              const data = {
                date_time: new Date().toISOString(),
                flags: ['from-bling']
              }

              ;[
                [financialStatus, 'payments_history'],
                [fulfillmentStatus, 'fulfillments']
              ].forEach(([newStatus, subresource]) => {
                if (
                  newStatus &&
                  (!order[subresource] || getLastStatus(order[subresource]) !== newStatus)
                ) {
                  data.status = newStatus
                  const endpoint = `/orders/${order._id}/${subresource}.json`
                  promises.push(appSdk.apiRequest(storeId, endpoint, 'POST', data, auth))
                }
              })
              return Promise.all(promises).then(([firstResult]) => firstResult)
            })
          })

          .then(payload => {
            try {
              documentRef.set({
                storeId,
                situacao,
                updatedAt: firestore.Timestamp.fromDate(new Date())
              })
            } catch (err) {
              logger.error(err)
            }
            return (payload && payload.response) || payload
          })
      })
    })
  handleJob({ appSdk, storeId }, queueEntry, job)

  return Promise.resolve()
}
