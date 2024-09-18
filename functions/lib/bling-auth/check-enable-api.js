const adimin = require('firebase-admin')
const { logger } = require('../../context')

const { Timestamp } = adimin.firestore
const firestoreColl = 'bling_tokens'

module.exports = async (storeId) => {
  let docRef
  if (firestoreColl) {
    docRef = adimin.firestore()
      .doc(`${firestoreColl}/${storeId}`)
  }
  const docSnapshot = await docRef.get()
  if (docSnapshot.exists) {
    const {
      isBloqued,
      updatedAt,
      isRateLimit
    } = docSnapshot.data()

    const now = Timestamp.now()
    const timeLimitBloqued = Timestamp.fromMillis(updatedAt.toMillis() + (24 * 60 * 60 * 1000))
    if ((isRateLimit && now.toMillis() < timeLimitBloqued.toMillis()) || isBloqued) {
      if (isBloqued) {
        logger.warn('Bling refreshToken is invalid need to update')
      }
      return false
    }
    return true
  }
  return false
}
