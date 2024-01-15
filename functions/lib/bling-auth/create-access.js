const createAxios = require('./create-axios')
const auth = require('./create-auth')
const { getFirestore } = require('firebase-admin/firestore')

const firestoreColl = 'bling_tokens'
module.exports = function (clientId, clientSecret, code, storeId) {
  const self = this

  let documentRef
  if (firestoreColl && storeId) {
    documentRef = require('firebase-admin')
      .firestore()
      .doc(`${firestoreColl}/${storeId}`)
  } else if (firestoreColl) {
    const db = getFirestore()
    const d = new Date(new Date().getTime() - 9000)
    const documentSnapshot = db.collection(firestoreColl)
      .where('updatedAt', '<=', d)
      .orderBy('updatedAt')
      .limit(1)
      .get()
    if (!documentSnapshot.empty) {
      storeId = documentSnapshot.storeId
      clientId = documentSnapshot.clientId
      clientSecret = documentSnapshot.clientSecret
      documentRef = require('firebase-admin')
        .firestore()
        .doc(`${firestoreColl}/${storeId}`)
    } 
  }

  this.preparing = new Promise((resolve, reject) => {
    const authenticate = (token) => {
      self.axios = createAxios(token)
      resolve(self)
    }

    const handleAuth = (clientId, clientSecret, code, storeId, refreshToken) => {
      console.log('> Bling Auth02 ', storeId)
      auth(clientId, clientSecret, code, storeId, refreshToken)
        .then((data) => {
          console.log('> Bling token => ', data)
          authenticate(data.access_token)
          if (documentRef) {
            documentRef.set({
              ...data,
              storeId,
              clientId,
              clientSecret,
              updatedAt: Timestamp.now()
            }).catch(console.error)
          }
        })
        .catch(reject)
    }

    if (documentRef) {
      documentRef.get()
        .then((documentSnapshot) => {
          if (documentSnapshot.exists &&
            Date.now() - documentSnapshot.updateTime.toDate().getTime() <= 10000 // token expires in 21600 ms
          ) {
            authenticate(documentSnapshot.get('access_token'))
          } else {
            handleAuth(clientId, clientSecret, code, storeId, documentSnapshot.get('refresh_token'))
          }
        })
        .catch(console.error)
    } else {
      handleAuth(clientId, clientSecret, code, storeId)
    }
  })
}

