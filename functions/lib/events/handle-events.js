// const { Timestamp, getFirestore  } = require('firebase-admin')
const { nameCollectionEvents } = require('./../../__env')
const admin = require('firebase-admin')
const getAppData = require('../store-api/get-app-data')
const { logger } = require('../../context')
const { getAppSdk, log } = require('./utils')

const firestore = admin.firestore
const Timestamp = firestore.Timestamp

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

const runDoc = async (docId, doc) => {
  const data = doc.data()
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

  logger.info(`Event ${eventBy} StoreId ${storeId}`)
  const now = Timestamp.now()
  // const processingTime = processingAt && (now.toMillis() - processingAt.toMillis())
  // const isProcessing = processingTime && processingTime < limiteTime
  // logger.info(`${isProcessing ? 'Processing' : ''} ${processingTime || 0}ms`)
  // if (isProcessing) {
  //   logger.info(`Skip document ${docId} => is processing: ${action} ${queue} #${resourceId} time: ${processingTime} ms `)
  //   return null
  // } else {
  const appSdk = await getAppSdk()
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
          logger.error(err)
          const now = Timestamp.now()
          // const processingTime = processingAt && (now.toMillis() - processingAt.toMillis())
          // const isProcessing = processingTime && processingTime < limiteTime
          const attempts = (data.attempts || 0) + 1
          await doc.ref.delete()
          if (attempts < 3) {
            await firestore.doc(docId).set({
              ...data,
              createdAt: now
            })
          //   const delay = (timeout) => new Promise(resolve => setTimeout(() => resolve(true), timeout || 60 * 1000))
          //   // update to retry
          //   await delay(isProcessing ? (limiteTime - processingTime) : 10)
          //   await doc.ref.set({ attempts }, { merge: true })
          }

          if (!queueEntry.isNotQueued) {
            return log({ appSdk, storeId }, queueEntry, err)
          }
          throw err
        })
    }
  }
  // }
}

const addQueueEvents = async (change, context) => {
  const { docId } = context.params
  const isAdd = change.after.exists
  // if (!change.after.exists) {
  //   return null
  // }

  logger.info(`docId: ${docId}`)
  const doc = change.after

  const {
    storeId,
    eventBy
  } = doc.data()

  const documentId = `${nameCollectionEvents}_${eventBy}/${docId}`
  if (storeId > 100) {
    const docRefQueue = firestore()
      .doc(`queue_controller/${storeId}`)

    if (docRefQueue) {
      const nameFunction = isAdd ? 'arrayUnion' : 'arrayRemove'
      await docRefQueue.update({
        storeId,
        queue: firestore.FieldValue[nameFunction](documentId),
        updatedAt: new Date().toISOString()
      })
    } else {
      await docRefQueue.set({
        storeId,
        queue: isAdd ? [documentId] : [],
        updatedAt: new Date().toISOString()
      }, { merge: true })
    }
  }

  return null
}

const controllerQueueEvents = async (change, context) => {
  const { docId } = context.params
  if (!change.after.exists) {
    return null
  }

  logger.info(`docId: ${docId}`)
  const doc = change.after

  const {
    storeId,
    docRun,
    queue
  } = doc.data()

  if (storeId > 100) {
    const docId = queue && queue.length && queue[0]
    if (!docRun || docRun !== docId) {
      // ler o documento
    // adiciona no docRun e
    // processing
    // e executo
    // quando finalizar remove o docRun
      const docQueue = await firestore().doc(docId).get()
      await docQueue.ref.update({
        docRun: docId
      })

      await runDoc(docId, docQueue)
        .then(() => {
          docQueue.ref.update({
            docRun: firestore.FieldValue.delete()
          })
        })
    }
  }

  return null
}

module.exports = {
  addQueueEvents,
  controllerQueueEvents
}
