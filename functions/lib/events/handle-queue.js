const admin = require('firebase-admin')
const { nameCollectionEvents } = require('../../__env')
const { sendMessageTopic } = require('./utils')
const { logger } = require('../../context')

const limitTimeProcessing = (2 * 60 * 1000)
const Timestamp = admin.firestore.Timestamp

const addEventsQueue = async (change, context) => {
  const strStoreId = context.params.storeId
  if (strStoreId === '1024' || strStoreId === '51372') {
    return null
  }

  const docRefQueue = await admin.firestore().doc(`queue/${strStoreId}`).get()

  const collectionName = `queue/${strStoreId}/${nameCollectionEvents}`
  const eventRef = admin.firestore().collection(collectionName)

  const oldestEventSnapshot = await eventRef
    .orderBy('createdAt', 'asc')
    .limit(1)
    .get()

  if (!oldestEventSnapshot.empty) {
    const docOldestEvent = oldestEventSnapshot.docs[0]
    const oldestEvent = docOldestEvent.data()
    const {
      storeId,
      processingAt
    } = oldestEvent

    const documentId = `${collectionName}/${docOldestEvent.id}`
    const now = Timestamp.now()
    const processingTime = processingAt && (now.toMillis() - processingAt.toMillis())
    const isProcessing = processingTime && processingTime < limitTimeProcessing
    if (!processingAt) {
      await sendMessageTopic('events', { documentId, storeId })
        .then(() => {
          logger.info(`> Start ${docOldestEvent.id} => ${documentId}`)
          return docOldestEvent.ref.set({
            processingAt: Timestamp.now()
          }, { merge: true })
        })

      await docRefQueue.ref.set({
        updatedAt: Timestamp.now()
      }, { merge: true })
    } else if (!isProcessing) {
      await docOldestEvent.ref.delete()
    }
  }

  return null
}

module.exports = {
  addEventsQueue
}
