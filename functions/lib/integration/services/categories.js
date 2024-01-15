const Bling = require('../../bling-auth/create-access')

const getCategories = async (appData, storeId) => {
  const { client_id, client_secret, code, bling_store } = appData
  const bling = new Bling(client_id, client_secret, code, storeId)
  const blingCategories = await bling.get(`/categorias/lojas?idLoja=${bling_store}`)
  return blingCategories && blingCategories.data && blingCategories.data.data
}

const getSpecificCategory = async (appData, storeId, id) => {
  const { client_id, client_secret, code } = appData
  const bling = new Bling(client_id, client_secret, code, storeId)
  const blingCategory = await bling.get(`/categorias/lojas/${id}`)
  return blingCategory && blingCategory.data && blingCategory.data.data
}

const postCategory = async (appData, storeId, body) => {
  const { client_id, client_secret, code } = appData
  const bling = new Bling(client_id, client_secret, code, storeId)
  const createdCategory = await bling.put(`/categorias/lojas`, body)
  return createdCategory && createdCategory.data && createdCategory.data.data
}


module.exports = {
  getCategories,
  getSpecificCategory,
  postCategory
}
