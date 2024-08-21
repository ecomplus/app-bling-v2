const Bling = require('../../bling-auth/client')

const getCategories = async (appData, storeId) => {
  const {
    client_id: clientId,
    client_secret: clientSecret,
    bling_store: blingStore
  } = appData
  const bling = new Bling(clientId, clientSecret, storeId)
  const blingCategories = await bling.get(`/categorias/lojas?idLoja=${blingStore}`)
  return blingCategories && blingCategories.data && blingCategories.data.data
}

const getSpecificCategory = async (appData, storeId, id) => {
  const {
    client_id: clientId,
    client_secret: clientSecret
  } = appData
  const bling = new Bling(clientId, clientSecret, storeId)
  const blingCategory = await bling.get(`/categorias/lojas/${id}`)
  return blingCategory && blingCategory.data && blingCategory.data.data
}

const postCategory = async (appData, storeId, body) => {
  const {
    client_id: clientId,
    client_secret: clientSecret
  } = appData
  const bling = new Bling(clientId, clientSecret, storeId)
  const createdCategory = await bling.put('/categorias/lojas', body)
  return createdCategory && createdCategory.data && createdCategory.data.data
}

module.exports = {
  getCategories,
  getSpecificCategory,
  postCategory
}
