const getAppData = require('../store-api/get-app-data')
// const updateAppData = require('../store-api/update-app-data')
const { Timestamp, getFirestore } = require('firebase-admin/firestore')

// async integration handlers
const integrationHandlers = {
  exportation: {
    product_ids: require('./export-product'),
    order_ids: require('./export-order')
  },
  importation: {
    skus: require('./import-product'),
    order_numbers: require('./import-order')
  }
}

module.exports = async (appSdk, storeIdStr, collectionId) => {
  const storeId = parseInt(storeIdStr, 10)
  console.log('>> ', storeId, collectionId)
  // .doc(`events/${storeId}/storeApi/${nextId}`)
  if (collectionId === 'storeApi') {
    const listDocs = await getFirestore()
      .collection(`events/${storeId}/storeApi`)
      .orderBy('createdAt', 'asc')
      .get()
      .then(async querySnapshot => {
        return querySnapshot.docs
      })
    let i = 0
    let doc
    const docToDelete = []
    const now = Timestamp.now()

    while (i < listDocs.length) {
      console.log('> i ', i)
      doc = listDocs[i]
      const data = doc.data()
      if (data.isProcess) {
        const deadLine = data.processingAt.toMillis() + (2 * 24 * 60 * 60 * 1000) // 2 day
        const timeToSkip = data.processingAt.toMillis() + (2 * 60 * 1000) // 2 minutes
        if (now.toMillis() > deadLine) {
          docToDelete.push(doc.ref.delete())
          doc = undefined
        } else if (now.toMillis() < timeToSkip) {
          console.log('>> skip ')
          doc = undefined
          break
        }
      } else {
        break
      }
      i += 1
    }

    console.log('>> aqui ', doc?.exists, ' ', i)
    if (doc?.exists && !doc.data().isProcess) {
      const {
        // webhook,
        // resource,
        // trigger,
        storeId,
        queueEntry,
        canCreateNew
        // createdAt,
      } = doc.data()

      await doc.ref
        .set({ isProcess: true, processingAt: now }, { merge: true })
        .catch(console.error)

      const { action, queue, nextId } = queueEntry
      const handlerName = action.replace(/^_+/, '')
      console.log('>> handler', handlerName, ' ', queue)
      const handler = integrationHandlers[handlerName][queue.toLowerCase()]

      const isHiddenQueue = action.charAt(0) === '_'
      // const mustUpdateAppQueue = trigger === 'applications'

      if (handler) {
        // console.log('> ', isHiddenQueue, mustUpdateAppQueue, ' <')
        const debugFlag = `#${storeId} ${action}/${queue}/${nextId}`
        console.log(`> Starting ${debugFlag}`)
        await appSdk.getAuth(storeId).then((auth) => {
          return getAppData({ appSdk, storeId, auth })
            .then(async appData => {
              const blingClientId = appData.client_id
              const blingStore = appData.bling_store
              const blingDeposit = appData.bling_deposit

              return handler(
                { appSdk, storeId, auth },
                blingClientId,
                blingStore,
                blingDeposit,
                queueEntry,
                appData,
                canCreateNew,
                isHiddenQueue
              ).then(() => {
                console.log('OKKK')
              })
            })
        })
      }
    }
    if (docToDelete.length) {
      await Promise.all(docToDelete)
    }
  } else if (collectionId === 'bling') {
    // Todo:  handle Bling events
  } else {
    return null
  }
}
