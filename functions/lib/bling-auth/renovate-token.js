const auth = require('./create-auth')
const { getFirestore, Timestamp } = require('firebase-admin/firestore')

const firestoreColl = 'bling_tokens'
module.exports = async () => {

  let documentRef, storeId, clientId, clientSecret, refreshToken
  if (firestoreColl) {
    const db = getFirestore()
    const d = new Date(new Date().getTime() - 9000)
    const documentSnapshot = await db.collection(firestoreColl)
      .where('updatedAt', '<=', d)
      .orderBy('updatedAt')
      .limit(1)
      .get()
    const info = documentSnapshot.docs && documentSnapshot.docs[0] && documentSnapshot.docs[0].data()
    storeId = info.storeId
    clientId = info.clientId
    clientSecret = info.clientSecret
    refreshToken = info.refresh_token
    documentRef = require('firebase-admin')
        .firestore()
        .doc(`${firestoreColl}/${storeId}`)
  }

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
            updatedAt: Timestamp.now()
          }).catch(console.error)
        }
      })
  }

  if (documentRef) {
    documentRef.get()
      .then((documentSnapshot) => {
        if (documentSnapshot.exists &&
          Date.now() - documentSnapshot.updateTime.toDate().getTime() <= 10000 // token expires in 21600 ms
        ) {
          return
        } else {
          handleAuth(clientId, clientSecret, code = undefined, storeId, documentSnapshot.get('refresh_token'))
        }
      })
      .catch(console.error)
  } else {
    handleAuth(clientId, clientSecret, code, storeId)
  }
}

