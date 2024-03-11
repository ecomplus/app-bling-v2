const auth = require('./create-auth')
const { getFirestore, Timestamp } = require('firebase-admin/firestore')

const firestoreColl = 'bling_tokens'
const lastTimeUpdate = 1 * 5 * 60 * 1000

module.exports = async () => {
  const maxDocs = 15
  const now = Timestamp.now()

  const handleAuth = async (document) => {
    const doc = document.data()
    const {
      clientId,
      clientSecret,
      refresh_token: refreshToken,
      storeId
    } = doc
    console.log('> Renove Token Bling ', storeId, JSON.stringify(doc))
    const data = await auth(clientId, clientSecret, null, storeId, refreshToken)
    console.log('> Bling new token => ', JSON.stringify(data))
    if (document.ref) {
      return document.ref.set(
        {
          ...data,
          updatedAt: now,
          expiredAt: Timestamp.fromMillis(now.toMillis() + lastTimeUpdate)
        },
        { merge: true }
      ).catch(console.error)
    }
  }

  if (firestoreColl) {
    const db = getFirestore()
    const lastDate = Timestamp.fromMillis(now.toMillis() - lastTimeUpdate)
    console.log('> ExpiredAt <= ', lastDate.toDate())
    const documentSnapshot = await db.collection(firestoreColl)
      .where('expiredAt', '<', Timestamp.fromMillis(now.toMillis() + 1 * 60 * 1000))
      .where('expiredAt', '>=', lastDate)
      .orderBy('expiredAt')
      .get()

    const { docs } = documentSnapshot
    console.log(`There is ${docs && docs.length} docs expiring in two hours`)
    const maxExistedDocs = docs && docs.length > maxDocs
      ? maxDocs
      : (docs && docs.length) || 0
    console.log('max existed docs', maxExistedDocs)
    const promises = []
    if (maxExistedDocs) {
      for (let i = 0; i < maxExistedDocs; i++) {
        const docRef = docs[i]
        if (docRef.data()?.storeId) {
          promises.push(handleAuth(docRef))
        }
      }
    }
    await Promise.all(promises)
  }
}
