const Bling = require('../../bling-auth/create-access')

const searchProduct = async (appData, storeId, sku) => {
  const { client_id, client_secret, code } = appData
  const bling = new Bling(client_id, client_secret, code, storeId)
  const blingSearch = await bling.get(`/produtos?codigo=${sku}&limite=1`)
  return blingSearch && blingSearch.data && blingSearch.data.data
}

const getProduct = async (appData, storeId, id) => {
  const { client_id, client_secret, code } = appData
  const bling = new Bling(client_id, client_secret, code, storeId)
  const blingProduct = await bling.get(`/produtos/${id}`)
  return blingProduct && blingProduct.data && blingProduct.data.data
}

const updateProduct = async (appData, storeId, id, body) => {
  const { client_id, client_secret, code } = appData
  const bling = new Bling(client_id, client_secret, code, storeId)
  const updatedProduct = await bling.put(`/produtos/${id}`, body)
  return updatedProduct && updatedProduct.data && updatedProduct.data.data
}

const listSpecificProductStore = async (appData, storeId, id) => {
  const { client_id, client_secret, code } = appData
  const bling = new Bling(client_id, client_secret, code, storeId)
  const blingSearchSpecificStore = await bling.get(`/produtos/lojas${id}`)
  return blingSearchSpecificStore && blingSearchSpecificStore.data && blingSearchSpecificStore.data.data
}

const listProductStore = async (appData, storeId) => {
  const { client_id, client_secret, code, bling_store } = appData
  const bling = new Bling(client_id, client_secret, code, storeId)
  const products = []
  let page = 1
  let count = 0
  do {
    try {
      const url = `/produtos/lojas?idLoja=${bling_store}&page=${page}`
      const { data } = await bling.get(url)
      count = data.data.length
      page++
      data.data.forEach((pedido) => products.push(pedido))
    } catch (err) {
      if (err.response) {
        logger.warn('cant list products', {
          url: err.config.url,
          body: err.config.data,
          response: err.response.data,
          status: err.response.status
        })
      } else {
        throw err
      }
    }
  } while (count >= 100)
  return products
}


module.exports = {
  getProduct,
  listProductStore,
  listSpecificProductStore,
  searchProduct,
  updateProduct
}
