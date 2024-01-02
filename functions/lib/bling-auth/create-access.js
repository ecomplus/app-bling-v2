const createAxios = require('./create-axios')
const auth = require('./create-auth')

const firestoreColl = 'bling_tokens'
module.exports = function (clientId, clientSecret, code, storeId) {
  const self = this

  let documentRef
  if (firestoreColl) {
    documentRef = require('firebase-admin')
      .firestore()
      .doc(`${firestoreColl}/${storeId}`)
  }

  this.preparing = new Promise((resolve, reject) => {
    const authenticate = (token) => {
      self.axios = createAxios(token)
      resolve(self)
    }

    const handleAuth = (refreshToken) => {
      console.log('> Bling Auth02 ', storeId)
      auth(clientId, clientSecret, code, storeId, refreshToken)
        .then((data) => {
          console.log('> Bling token => ', data)
          authenticate(data.access_token)
          if (documentRef) {
            documentRef.set({
              ...data,
              updatedAt: new Date().toISOString()
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
            handleAuth(documentSnapshot.get('refresh_token'))
          }
        })
        .catch(console.error)
    } else {
      handleAuth()
    }
  })
}

