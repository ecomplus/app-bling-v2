const createAxios = require('./create-axios')
const blingAuth = require('./create-auth')
const { Timestamp } = require('firebase-admin/firestore')
const logger = console

const firestoreColl = 'bling_tokens'

module.exports = async function (clientId, clientSecret, storeId, tokenExpirationGap = 9000) {
  let docRef
  if (firestoreColl) {
    docRef = require('firebase-admin')
      .firestore()
      .doc(`${firestoreColl}/${storeId}`)
  }
  const docSnapshot = await docRef.get()
  let accessToken
  if (docSnapshot.exists) {
    const {
      access_token: docAccessToken,
      refresh_token: refreshToken,
      expiredAt
    } = docSnapshot.data()

    const now = Timestamp.now()
    if (now.toMillis() + tokenExpirationGap < expiredAt.toMillis()) {
      accessToken = docAccessToken
    } else {
      try {
        const data = await blingAuth(clientId, clientSecret, null, storeId, refreshToken)
        docRef.set({
          ...data,
          updatedAt: now,
          expiredAt: Timestamp.fromMillis(now.toMillis() + ((data.expires_in - 3600) * 1000))
        }, { merge: true })
        accessToken = data.access_token
      } catch (err) {
        logger.warn('Cant refresh Bling OAtuh token', {
          url: err.config.url,
          body: err.config.data,
          response: err.response.data,
          status: err.response.status
        })
        throw err
      }
    }
  } else {
    throw Error('No Bling token document')
  }

  return createAxios(accessToken)
}
