const { Timestamp } = require('firebase-admin/firestore')
const admin = require('firebase-admin')
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

// const limiteTime = (2 * 60 * 1000)

const handleEvents = async (
  {
    documentId,
    storeId
  },
  context
) => {
  logger.info(`>[${storeId}] Exec Event ${context.eventId} => ${documentId}`)
  const docRef = await admin.firestore().doc(`${documentId}`).get()
  const data = docRef?.data()

  if (docRef.exists) {
    const {
      eventBy,
      storeId,
      action,
      resourceId,
      queue,
      canCreateNew,
      mustUpdateAppQueue,
      isHiddenQueue
      // processingAt
    } = data

    const appSdk = await getAppSdk()
    const auth = await appSdk.getAuth(storeId)
    const appData = await getAppData({ appSdk, storeId, auth }, true)

    if (appData) {
      const blingStore = appData.bling_store
      const blingDeposit = appData.bling_deposit

      const handler = integrationHandlers[action][queue.toLowerCase()]
      const queueEntry = { action, queue, nextId: resourceId, mustUpdateAppQueue }

      if (resourceId && handler) {
        logger.info(`> Start [${eventBy}]: ${action} ${queue} ${resourceId}`)
        await handler(
          { appSdk, storeId, auth },
          blingStore,
          blingDeposit,
          queueEntry,
          appData,
          canCreateNew,
          isHiddenQueue
        ).then(async (response) => {
          logger.info(`>Finish ${action} ${queue} ${resourceId} [${documentId}]`)
          await docRef.ref
            .delete()
            .catch(logger.error)

          return log({ appSdk, storeId }, queueEntry, response)
        })
          .catch(async (err) => {
            logger.warn('Catch error')
            if (err.response?.status === 503) {
              setTimeout(() => {
                logger.warn(`> Error ${documentId}`)
                docRef.ref.delete()
                delete data.processingAt
                return admin.firestore().doc(`${documentId}`)
                  .set({
                    ...data,
                    createdAt: Timestamp.now()
                  })
                // throw err
              }, 1000)
              return
            }

            logger.error(err)
            if (!queueEntry.isNotQueued) {
              return log({ appSdk, storeId }, queueEntry, err)
            }

            throw err
          })
      }
    }
  }
}

module.exports = handleEvents
