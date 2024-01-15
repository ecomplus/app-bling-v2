const Bling = require('../../bling-auth/create-access')

const getCustomer = async (appData, storeId, docNumber) => {
  const { client_id, client_secret, code } = appData
  const bling = new Bling(client_id, client_secret, code, storeId)
  const blingCustomer = await bling.get(`/contatos?limite=1&pesquisa=${docNumber}`)
  return blingCustomer && blingCustomer.data && blingCustomer.data.data
}

const postCustomer = async (appData, storeId, body) => {
  const { client_id, client_secret, code } = appData
  const bling = new Bling(client_id, client_secret, code, storeId)
  const createdCustomer = await bling.put(`/contatos`, body)
  return createdCustomer && createdCustomer.data && createdCustomer.data.data
}


module.exports = {
  getCustomer,
  postCustomer
}
