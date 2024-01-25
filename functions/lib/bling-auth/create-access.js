const createAxios = require('./create-axios')
const auth = require('./create-auth')
const { getFirestore, Timestamp } = require('firebase-admin/firestore')

const firestoreColl = 'bling_tokens'
const now = Timestamp.now().toMillis()
module.exports = function (clientId, clientSecret, code, storeId) {
  const self = this

  let documentRef
  if (firestoreColl && storeId) {
    documentRef = require('firebase-admin')
      .firestore()
      .doc(`${firestoreColl}/${storeId}`)
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
          console.log('> Bling token => ', JSON.stringify(data))
          if (!documentRef) {
            documentRef = require('firebase-admin')
            .firestore()
            .doc(`${firestoreColl}/${storeId}`)
          }
          if (documentRef) {
            documentRef.set({
              ...data,
              storeId,
              clientId,
              clientSecret,
              expiredAt: Timestamp.fromMillis(now + ((res.data.expires_in - 300) * 1000)),
              updatedAt: Timestamp.now()
            }).catch(console.error)
          }
          authenticate(data.access_token)
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

