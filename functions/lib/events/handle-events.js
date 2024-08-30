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

module.exports = async (change, context) => {
  const appSdk = await getAppSdk()
  const { docId } = context.params
  logger.info(`docId: ${docId}`)
  if (!change.after.exists) {
    console.log(`Document  #${docId} not exists`)
    return null
  }

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
  console.log(`${JSON.stringify(data)}`)

  if (storeId > 100) {
    logger.info(`Event ${eventBy} StoreId ${storeId}`)
    const now = Timestamp.now()
    const processingTime = processingAt && (now.toMillis() - processingAt.toMillis())
    const isProcessing = processingTime && processingTime < (2 * 60 * 1000)
    logger.info(`${isProcessing} ${processingTime}ms`)

    if (!isProcessing) {
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
            console.log('Finish export', queue, JSON.stringify(response?.data))
            await doc.ref
              .delete()
              .catch(logger.error)

            return log({ appSdk, storeId }, queueEntry, response)
          })
            .catch(err => {
              logger.error(err)
              if (!queueEntry.isNotQueued) {
                return log({ appSdk, storeId }, queueEntry, err)
              }
            })
        }
      }
    } else {
      logger.info(`Skip document ${docId} => is processing: ${action} ${queue} #${resourceId} time: ${processingTime} ms `)
    }
  }

  return null
}
