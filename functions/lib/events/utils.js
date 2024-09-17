const admin = require('firebase-admin')
const functions = require('firebase-functions')
const { PubSub } = require('@google-cloud/pubsub')
const { setup } = require('@ecomplus/application-sdk')
const { logger } = require('../../context')
const getAppData = require('../store-api/get-app-data')
const updateAppData = require('../store-api/update-app-data')

const getAppSdk = () => {
  return new Promise(resolve => {
    setup(null, true, admin.firestore())
      .then(appSdk => resolve(appSdk))
  })
}

const queueRetry = (appSession, { action, queue, nextId }, appData, response) => {
  const retryKey = `${appSession.storeId}_${action}_${queue}_${nextId}`
  const documentRef = require('firebase-admin')
    .firestore()
    .doc(`integration_retries/${retryKey}`)

  return documentRef.get()
    .then(documentSnapshot => {
      if (documentSnapshot.exists) {
        if (Date.now() - documentSnapshot.updateTime.toDate().getTime() > 5 * 60 * 1000) {
          documentRef.delete().catch(logger.error)
        } else {
          logger.info(`> Skip retry: ${retryKey}`)
          return null
        }
      }

      let queueList = appData[action] && appData[action][queue]
      if (!Array.isArray(queueList)) {
        queueList = [nextId]
      } else if (!queueList.includes(nextId)) {
        queueList.unshift(nextId)
      }

      const body = {
        d: new Date().toISOString()
      }

      if (response?.data) {
        body.data = response.data
        body.status = response.status || 0
      }

      return new Promise((resolve, reject) => {
        setTimeout(() => {
          updateAppData(appSession, {
            [action]: {
              ...appData[action],
              [queue]: queueList
            }
          })
            .then(() => documentRef.set(body))
            .then(resolve)
            .catch(reject)
        }, 7000)
      })
    })
}

const log = ({ appSdk, storeId }, queueEntry, payload) => {
  const isError = payload instanceof Error
  const isImportation = queueEntry.action.endsWith('importation')

  appSdk.getAuth(storeId)
    .then(auth => {
      return getAppData({ appSdk, storeId, auth })
        .then(appData => {
          let { logs } = appData
          if (!Array.isArray(logs)) {
            logs = []
          }
          const logEntry = {
            resource: /order/i.test(queueEntry.queue) ? 'orders' : 'products',
            [(isImportation ? 'bling_id' : 'resource_id')]: queueEntry.nextId,
            success: !isError,
            timestamp: new Date().toISOString()
          }

          let notes, retrying
          if (payload) {
            if (!isError) {
              const { data, status, config } = payload
              if (data && data._id) {
                logEntry.resource_id = data._id
              }
              notes = `Status ${status}`
              if (config) {
                notes += ` [${config.url}]`
              }
            } else {
              const { config, response } = payload
              if (response) {
                const { data, status } = response
                notes = `Error: Status ${status} \n${JSON.stringify(data)}`
                if (!status || status >= 500 || status === 429) {
                  retrying = queueRetry({ appSdk, storeId, auth }, queueEntry, appData, response)
                }
                if (config) {
                  const { url, method, data } = config
                  notes += `\n\n-- Request -- \n${method} ${url}`
                  if (data) {
                    notes += ` \n${data.xml}`
                  }
                }
              } else if (payload.isConfigError === true) {
                notes = payload.message
              } else {
                notes = payload.stack
              }
            }
          }
          if (notes) {
            logEntry.notes = notes.substring(0, 5000)
          }

          const checkUpdateQueue = () => {
            if (queueEntry.mustUpdateAppQueue) {
              const updateQueue = () => {
                const { action, queue, nextId } = queueEntry
                let queueList = appData[action][queue]
                if (Array.isArray(queueList)) {
                  const idIndex = queueList.indexOf(nextId)
                  if (idIndex > -1) {
                    queueList.splice(idIndex, 1)
                  }
                } else {
                  queueList = []
                }
                const data = {
                  [action]: {
                    ...appData[action],
                    [queue]: queueList
                  }
                }
                logger.info(`#${storeId} ${JSON.stringify(data)}`)
                updateAppData({ appSdk, storeId, auth }, data).catch(err => {
                  if (err.response && (!err.response.status || err.response.status >= 500)) {
                    queueRetry({ appSdk, storeId, auth }, queueEntry, appData, err.response)
                  } else {
                    throw err
                  }
                })
              }

              if (retrying) {
                retrying
                  .then(result => {
                    if (result === null) {
                      updateQueue()
                    }
                  })
                  .catch(updateQueue)
              } else {
                updateQueue()
              }
            }
          }

          if (queueEntry.documentRef && queueEntry.documentRef.get) {
            queueEntry.documentRef.get()
              .then(documentSnapshot => {
                if (documentSnapshot.exists) {
                  const data = documentSnapshot.data()
                  if (data[queueEntry.key] === false) {
                    queueEntry.mustUpdateAppQueue = false
                  }
                  setTimeout(() => {
                    queueEntry.documentRef.set({
                      _count: data._count > 0 ? data._count - 1 : 0,
                      [queueEntry.key]: false
                    }, {
                      merge: true
                    }).catch(logger.error)
                  }, queueEntry.mustUpdateAppQueue ? 900 : 400)
                }
              })
              .then(checkUpdateQueue)
              .catch(err => {
                logger.error(err)
                checkUpdateQueue()
              })
          } else {
            checkUpdateQueue()
          }

          if (isError || !isImportation) {
            logs.unshift(logEntry)
            return updateAppData({ appSdk, storeId, auth }, {
              logs: logs.slice(0, 200)
            }, true)
          }
        })
    })
    .catch(logger.error)
}

const getPubSubTopic = (eventName) => {
  return `${eventName}_events`
}

const createPubSubFunction = (
  pubSubTopic,
  fn,
  eventMaxAgeMs = (2 * 60 * 1000)
) => {
  return functions
    .runWith({ failurePolicy: true })
    .pubsub.topic(pubSubTopic).onPublish((message, context) => {
      const eventAgeMs = Date.now() - Date.parse(context.timestamp)
      if (eventAgeMs > eventMaxAgeMs) {
        logger.warn(`Dropping event ${context.eventId} with age[ms]: ${eventAgeMs}`)
        const documentId = message.json.documentId
        if (documentId) {
          return admin.firestore().doc(`${documentId}`)
            .get()
            .then(async (docRef) => {
              if (docRef.exists) {
                logger.warn(`delete docummet ${documentId}`)
                await docRef.ref.delete()
              }
            })
        }
        return
      }
      return fn(message.json, context, message)
    })
}

const createEventsFunction = (
  eventName,
  fn,
  eventMaxAgeMs = (2 * 60 * 1000)
) => {
  const topicName = getPubSubTopic(eventName)
  return createPubSubFunction(topicName, fn, eventMaxAgeMs)
}

const sendMessageTopic = async (eventName, json) => {
  const topicName = getPubSubTopic(eventName)
  const messageId = await new PubSub()
    .topic(topicName)
    .publishMessage({ json })

  logger.info(`>> MessageId: ${messageId} Topic: ${topicName}`)

  return Promise.resolve(messageId)
}

module.exports = {
  getAppSdk,
  log,
  getPubSubTopic,
  createEventsFunction,
  sendMessageTopic
}
