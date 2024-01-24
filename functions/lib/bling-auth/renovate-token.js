const auth = require('./create-auth')
const { getFirestore, Timestamp } = require('firebase-admin/firestore')

const firestoreColl = 'bling_tokens'
module.exports = async () => {

  const maxDocs = 15
  const now = Timestamp.now().toMillis()

  const handleAuth = (clientId, clientSecret, code = undefined, storeId, refreshToken) => {
    console.log('> Bling Auth02 ', storeId)
    return auth(clientId, clientSecret, code, storeId, refreshToken)
      .then((data) => {
        console.log('> Bling token => ', JSON.stringify(data))
        if (documentRef) {
          return documentRef.set({
            ...data,
            storeId,
            clientId,
            clientSecret,
            updatedAt: Timestamp.fromMillis(now),
            expiredAt: Timestamp.fromMillis(now + ((res.data.expires_in - 300) * 1000))
          }).catch(console.error)
        }
      })
  }

  if (firestoreColl) {
    const db = getFirestore()
    const d = new Date(new Date().getTime() + 7200000)
    const documentSnapshot = await db.collection(firestoreColl)
      .where('updatedAt', '<=', d)
      .orderBy('updatedAt')
      .get()
    const { docs } = documentSnapshot
    const maxExistedDocs = docs && docs.length > maxDocs 
      ? maxDocs
      : (docs && docs.length) || 0
    console.log(`There is ${docs && docs.length} docs expiring in two hours`)
    if (maxExistedDocs) {
      for (let i = 0; i < maxExistedDocs; i++) {
        const doc = docs[i].data();
        const { storeId, clientId, clientSecret, refreshToken, expiredAt, updatedAt } = doc
        if (storeId) {
          const documentRef = require('firebase-admin')
            .firestore()
            .doc(`${firestoreColl}/${storeId}`)
            if (documentRef) {
              documentRef.get()
                .then((documentSnapshot) => {
                  const hasToCreateOauth = (documentSnapshot.exists &&
                    (now + 1000 * 60 * 60 * 2 + 1000 * 60 * 10 < updatedAt.toMillis()))
                  if (!hasToCreateOauth) {
                    handleAuth(clientId, clientSecret, code = undefined, storeId, documentSnapshot.get('refresh_token'))
                  }
                })
            } else {
              handleAuth(clientId, clientSecret, code, storeId)
            }
        }
      }
    }
  }
}

