const { Timestamp, getFirestore } = require('firebase-admin/firestore')
const { logger } = require('../../context')
const { nameCollectionEvents } = require('../../__env')

// const body = {
//   eventBy: 'ecomplus', // todo: remove?
//   storeId,
//   action: handlerName,
//   queue,
//   resourceId: nextId,
//   createdAt: now,
//   mustUpdateAppQueue, // todo remove?
//   isHiddenQueue // used in importation
// }
// if (canCreateNew !== undefined) {
//   Object.assign(body, { canCreateNew })
// }
// let canCreateNew = false
// case 'orders':
// canCreateNew = appData.new_orders ? undefined : false
// case 'products':
// if (trigger.action === 'create') {
//   if (!appData.new_products) {
//     break
//   }
//   canCreateNew = true

exports.post = async ({ appSdk, admin }, req, res) => {
  // const startTime = Date.now()
  // const blingToken = req.query.token
  const storeId = parseInt(req.query.store_id, 10)
  logger.info(`storeId: ${storeId} ${JSON.stringify(req.body)}`)

  if (storeId > 100 && req.body) {
    let { retorno } = req.body
    if (!retorno && typeof req.body.data === 'string') {
      try {
        const data = JSON.parse(req.body.data)
        retorno = data.retorno
      } catch (e) {
      }
    }
    const now = Timestamp.now()
    const body = {
      eventBy: 'bling',
      storeId,
      action: 'importation',
      createdAt: now,
      mustUpdateAppQueue: false,
      canCreateNew: false,
      isHiddenQueue: true
    }
    // const docRef = getFirestore().doc(`${nameCollectionEvents}/${storeId}_${nextId}`)
    const promises = []

    if (retorno) {
      console.log(`${JSON.stringify(retorno.estoques)}`)
      if (retorno.pedidos) {
        if (Array.isArray(retorno.pedidos) && retorno.pedidos.length && retorno.pedidos[0].pedido && retorno.pedidos[0].pedido.tipoIntegracao && retorno.pedidos[0].pedido.tipoIntegracao.toLowerCase() !== 'api') {
          // todo
          return res.sendStatus(200)
        }
      }

      if (retorno.estoques && retorno.estoques.length) {
        retorno.estoques.forEach(({ estoque }) => {
          console.log(`${JSON.stringify(estoque)}`)
          const { id, codigo } = estoque
          const resourceId = `${codigo};:`
          const docRef = getFirestore().doc(`${nameCollectionEvents}_bling/${storeId}_${id}`)
          promises.push(docRef.set({
            ...body,
            resourceId,
            queue: 'skus'
          }, { merge: true })
            .catch(logger.error)
          )
        })
      //   queue,
      // resourceId: nextId,
      }
      await Promise.all(promises)
      return res.sendStatus(200)
      /*
        TODO: check Bling server IPs
        const clientIp = req.get('x-forwarded-for') || req.connection.remoteAddress
        */
    } else {
      logger.log(`#${storeId} unexpected Bling callback: ${JSON.stringify(req.body)}`)
      return res.status(200)
        .send('Ignoring invalid request body')
    }
  }
  // console.log('> ', storeId, ' => ', blingToken, ' ', typeof blingToken === 'string')

  return res.sendStatus(403)
}
