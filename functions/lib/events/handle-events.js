const { Timestamp } = require('firebase-admin/firestore')
const getAppData = require('../store-api/get-app-data')
const { logger } = require('../../context')
const { getAppSdk, log } = require('./utils')

const integrationHandlers = {
  exportation: {
    product_ids: require('../integration/export-product'),
    order_ids: require('../integration/export-order')
  },
  importation: {
    skus: require('../integration/import-product'),
    order_numbers: require('../integration/import-order')
  }
}

const limiteTime = (2 * 60 * 1000)

module.exports = async (change, context) => {
  const { docId } = context.params
  if (!change.after.exists) {
    return null
  }

  const appSdk = await getAppSdk()
  logger.info(`docId: ${docId}`)
  const doc = change.after

  const data = doc.data()
  const {
    eventBy,
    storeId,
    action,
    resourceId,
    queue,
    canCreateNew,
    mustUpdateAppQueue,
    isHiddenQueue,
    processingAt
  } = data

  if (storeId > 100) {
    logger.info(`Event ${eventBy} StoreId ${storeId}`)
    const now = Timestamp.now()
    const processingTime = processingAt && (now.toMillis() - processingAt.toMillis())
    const isProcessing = processingTime && processingTime < limiteTime
    // logger.info(`${isProcessing ? 'Processing' : ''} ${processingTime || 0}ms`)
    if (isProcessing) {
      logger.info(`Skip document ${docId} => is processing: ${action} ${queue} #${resourceId} time: ${processingTime} ms `)
      return null
    } else {
      const auth = await appSdk.getAuth(storeId)
      const promises = await Promise.all([
        getAppData({ appSdk, storeId, auth }, true),
        doc.ref.set({ processingAt: now }, { merge: true })
      ])
      const appData = promises[0]
      if (appData) {
        const blingStore = appData.bling_store
        const blingDeposit = appData.bling_deposit

        const handler = integrationHandlers[action][queue.toLowerCase()]
        const queueEntry = { action, queue, nextId: resourceId, mustUpdateAppQueue }

        if (resourceId && handler) {
          logger.info(`>Start ${action} ${queue} ${resourceId}`)
          await handler(
            { appSdk, storeId, auth },
            blingStore,
            blingDeposit,
            queueEntry,
            appData,
            canCreateNew,
            isHiddenQueue
          ).then(async (response) => {
            logger.info(`>Finish ${action} ${queue} ${resourceId} [${docId}]`)
            await doc.ref
              .delete()
              .catch(logger.error)

            return log({ appSdk, storeId }, queueEntry, response)
          })
            .catch(async (err) => {
              const delay = (timeout) => new Promise(resolve => setTimeout(() => resolve(true), timeout || 60 * 1000))
              logger.error(err)
              const now = Timestamp.now()
              const processingTime = processingAt && (now.toMillis() - processingAt.toMillis())
              const isProcessing = processingTime && processingTime < limiteTime
              const attempts = (data.attempts || 0) + 1
              if (attempts < 3) {
                // update to retry
                await delay(isProcessing ? (limiteTime - processingTime) : 10)
                doc.ref.set({ attempts }, { merge: true })
              }

              if (!queueEntry.isNotQueued) {
                return log({ appSdk, storeId }, queueEntry, err)
              }
              return null
            })
        }
      }
    }
  }

  return null
}
