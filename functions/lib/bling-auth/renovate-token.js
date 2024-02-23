const auth = require('./create-auth')
const { getFirestore, Timestamp } = require('firebase-admin/firestore')

const firestoreColl = 'bling_tokens'
module.exports = async () => {
  const maxDocs = 15
  const now = new Date()

  const handleAuth = async (document) => {
    const doc = document.data()
    const {
      clientId,
      clientSecret,
      refresh_token: refreshToken,
      storeId
    } = doc
    console.log('> Renove Token Bling ', storeId)
    const data = await auth(clientId, clientSecret, undefined, storeId, refreshToken)
    console.log('> Bling new token => ', JSON.stringify(data))
    if (document.ref) {
      return document.ref.set(
        {
          ...data,
          updatedAt: Timestamp.fromDate(now),
          expiredAt: Timestamp.fromDate(new Date(now.getTime() + 7200000))
        },
        { merge: true }
      ).catch(console.error)
    }
  }

  if (firestoreColl) {
    const db = getFirestore()
    const date = new Date(new Date().getTime() + 7200000)
    console.log('> ExpiredAt <= ', date)
    const documentSnapshot = await db.collection(firestoreColl)
      .where('expiredAt', '<=', date)
      .orderBy('expiredAt')
      .get()

    const { docs } = documentSnapshot
    console.log(`There is ${docs && docs.length} docs expiring in two hours`)
    const maxExistedDocs = docs && docs.length > maxDocs
      ? maxDocs
      : (docs && docs.length) || 0
    console.log('max existed docs', maxExistedDocs)
    if (maxExistedDocs) {
      for (let i = 0; i < maxExistedDocs; i++) {
        const docRef = docs[i]
        if (docRef.data()?.storeId) {
          handleAuth(docRef)
        }
      }
    }
  }
}
