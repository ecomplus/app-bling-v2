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

const limiteTime = (2 * 60 * 1000)

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

  logger.info(`> [${docId}]: Event ${eventBy} StoreId ${storeId}`)
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
          const attempts = (data.attempts || 0) + 1
          await doc.ref.delete()
          if (attempts < 3) {
            // retry
            await firestore().doc(docId).set({
              ...data,
              attempts,
              createdAt: now
            })
          }

          if (!queueEntry.isNotQueued) {
            return log({ appSdk, storeId }, queueEntry, err)
          }
        })
    }
  }
}

const addEventsQueue = async (change, context) => {
  const { docId } = context.params
  const collectionPath = context.resource.name
  const collectionName = collectionPath.split('/')[5]
  const isAdd = change.after.exists
  // if (!change.after.exists) {
  //   return null
  // }
  const documentId = `${collectionName}/${docId}`
  logger.info(`docId: ${documentId}`)
  const storeId = change[`${isAdd ? 'after' : 'before'}`]?.data()?.storeId

  const nameFunction = isAdd ? 'arrayUnion' : 'arrayRemove'
  if (storeId > 100) {
    // TODO:
    if (storeId === 1024) {
      return null
    }
    const docRefQueue = firestore()
      .doc(`queue_controller/${storeId}`)

    if (docRefQueue) {
      const body = {
        storeId,
        queue: firestore.FieldValue[nameFunction](documentId),
        updatedAt: new Date().toISOString()
      }
      const runDocId = (await docRefQueue.get())?.data().runDocId
      if (runDocId && runDocId === documentId && !isAdd) {
        console.log('delete field')
        body.runDocId = firestore.FieldValue.delete()
      }
      await docRefQueue.set(body, { merge: true })
    } else {
      await docRefQueue.set({
        storeId,
        queue: firestore.FieldValue[nameFunction](documentId),
        updatedAt: new Date().toISOString()
      }, { merge: true })
    }
  }

  return null
}

const eventQueueController = async (change, context) => {
  // const { docId } = context.params
  // if (!change.after.exists) {
  //   return null
  // }

  // logger.info(`docId: ${docId}`)
  // const docController = change.after

  // const {
  //   storeId,
  //   runDocId,
  //   queue,
  //   processingAt
  // } = docController.data()

  // if (storeId > 100) {
  //   // TODO:
  //   if (storeId === 1024) {
  //     return null
  //   }
  //   const documentId = queue && queue.length && queue[0]
  //   const now = Timestamp.now()
  //   const processingTime = processingAt && (now.toMillis() - processingAt.toMillis())
  //   const isProcessing = processingTime && processingTime < limiteTime
  //   logger.info(`${runDocId} => ${documentId} ${isProcessing}`)
  //   if ((!runDocId && documentId) || (runDocId === documentId && !isProcessing)) {
  //     // ler o documento
  //   // adiciona no docRun e
  //   // processing
  //   // e executo
  //   // quando finalizar remove o docRun
  //     const docQueue = await firestore().doc(documentId).get()
  //     if (docQueue.exists) {
  //       console.log(docQueue.data())
  //     }

  //     await docController.ref.update({
  //       runDocId: documentId,
  //       processingAt: now
  //     })

  //     await runDoc(documentId, docQueue)
  //       .then(async () => {
  //         await docController.ref.update({
  //           runDocId: firestore.FieldValue.delete()
  //         })
  //         logger.info(`> finish ${documentId}`)
  //       })
  //   }
  // }

  return null
}

module.exports = {
  addEventsQueue,
  eventQueueController
}
