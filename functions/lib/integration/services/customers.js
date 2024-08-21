const Bling = require('../../bling-auth/client')

const getCustomer = async (appData, storeId, docNumber) => {
  const {
    client_id: clientId,
    client_secret: clientSecret
  } = appData
  const bling = new Bling(clientId, clientSecret, storeId)
  const blingCustomer = await bling.get(`/contatos?limite=1&pesquisa=${docNumber}`)
  return blingCustomer && blingCustomer.data && blingCustomer.data.data
}

const postCustomer = async (appData, storeId, body) => {
  const {
    client_id: clientId,
    client_secret: clientSecret
  } = appData
  const bling = new Bling(clientId, clientSecret, storeId)
  const createdCustomer = await bling.put('/contatos', body)
  return createdCustomer && createdCustomer.data && createdCustomer.data.data
}

module.exports = {
  getCustomer,
  postCustomer
}
