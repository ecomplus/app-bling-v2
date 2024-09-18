const admin = require('firebase-admin')
const { nameCollectionEvents } = require('../../__env')
// const { sendMessageTopic } = require('./utils')
const { logger } = require('../../context')

const limitTimeProcessing = (2 * 60 * 1000)
const Timestamp = admin.firestore.Timestamp

const deleteEvent = (storeId, id) => {
  return admin.firestore().doc(`running_events/${storeId}_${id}`)
    .delete()
}
const createEvent = async (storeId, id, documentId) => {
  return admin.firestore().doc(`running_events/${storeId}_${id}`)
    .set({
      documentId,
      storeId,
      createdAt: new Date().toISOString(),
      status: 'create'
    }, { merge: true })
  // return sendMessageTopic('webhooks', { documentId, storeId })
}

const addEventsQueue = async (change, context) => {
  const strStoreId = context.params.storeId
  // if (strStoreId !== '1131') {
  //   return null
  // }

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
      processingAt,
      attempts
    } = oldestEvent

    const id = docOldestEvent.id
    const documentId = `${collectionName}/${id}`
    const now = Timestamp.now()
    const processingTime = processingAt && (now.toMillis() - processingAt.toMillis())
    const isProcessing = processingTime && processingTime < limitTimeProcessing
    if (!storeId || attempts > 3) {
      await deleteEvent(storeId, id) // event starts only on creation
      await docOldestEvent.ref.delete()
    } else if (!processingAt) {
      await createEvent(storeId, id, documentId)
        .then(async () => {
          logger.info(`>[${storeId}] Send event ${id} => ${documentId}`)
          await docOldestEvent.ref.update({
            processingAt: Timestamp.now()
          })
        })
        .catch(async (err) => {
          logger.error(err)

          await docOldestEvent.ref.set({
            flag: 'Error'
          }, { merge: true })
        })

      await docRefQueue.ref.set({
        updatedAt: Timestamp.now()
      }, { merge: true })
    } else if (!isProcessing) {
      await deleteEvent(storeId, id) // event starts only on creation

      const attempts = (oldestEvent.attempts || 0) + 1
      if (attempts <= 3) {
        // send to the end of the queue
        await docOldestEvent.ref
          .update({
            processingAt: admin.firestore.FieldValue.delete(),
            createdAt: Timestamp.now(),
            attempts
          })
      } else {
        await deleteEvent(storeId, id) // event starts only on creation
        await docOldestEvent.ref.delete()
      }
    }
  }

  return null
}

module.exports = {
  addEventsQueue
}
