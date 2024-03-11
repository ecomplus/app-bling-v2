const createAxios = require('./create-axios')
const auth = require('./create-auth')
const { Timestamp } = require('firebase-admin/firestore')

const firestoreColl = 'bling_tokens'
module.exports = function (clientId, clientSecret, code, storeId, tokenExpirationGap = 9000) {
  const self = this

  let documentRef
  const now = Timestamp.now()
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

    const handleAuth = (clientId, clientSecret, code, storeId, refreshToken) => {
      console.log('> Bling Auth02 ', storeId)
      auth(clientId, clientSecret, code, storeId, refreshToken)
        .then(async (data) => {
          console.log('> Bling token => ', JSON.stringify(data))
          if (documentRef) {
            authenticate(data.access_token)
            const body = {
              ...data,
              storeId,
              clientId,
              clientSecret,
              updatedAt: now,
              expiredAt: Timestamp.fromMillis(now.toMillis() + (1 * 5 * 60 * 1000))
            }

            if (code) {
              body.code = code
            }

            documentRef.set(body, { merge: true }).catch(console.error)
          }
        })
        .catch(reject)
    }

    if (documentRef && !code) {
      documentRef.get()
        .then((documentSnapshot) => {
          const expiredAt = documentSnapshot.get('expiredAt')
          if (documentSnapshot.exists &&
            Timestamp.fromMillis(now.toMillis() + tokenExpirationGap) < expiredAt.toMillis() // token expires in 21600 s
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
