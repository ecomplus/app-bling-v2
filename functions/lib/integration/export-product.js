const ecomUtils = require('@ecomplus/utils')
const ecomClient = require('@ecomplus/client')
const errorHandling = require('../store-api/error-handling')
const Bling = require('../bling-auth/create-access')
const parseProduct = require('./parsers/product-to-bling')
const handleJob = require('./handle-job')

module.exports = ({ appSdk, storeId }, blingToken, blingStore, blingDeposit, queueEntry, appData, canCreateNew) => {
  const productId = queueEntry.nextId
  const { client_id, client_secret, code } = appData
  return ecomClient.store({
    storeId,
    url: `/products/${productId}.json`
  })

    .then(({ data }) => {
      const product = data
      let blingProductCode, originalBlingProduct, blingProductId
      let { metafields } = product
      if (metafields) {
        const metafieldCodigo = metafields.find(({ field }) => field === 'bling:codigo')
        const metafieldId = metafields.find(({ field }) => field === 'bling:id')
        if (metafieldCodigo) {
          blingProductCode = metafieldCodigo.value
        }
        if (metafieldId) {
          blingProductId = metafieldId.value
        }
      }
      if (!blingProductCode) {
        blingProductCode = product.sku
      }
      const bling = new Bling(client_id, client_secret, code, storeId)

      const job = bling.get(`/produtos`, {
        params: {
          codigo: blingProductCode,
          idLoja: blingStore
        }
      })
        .catch(err => {
          if (err.response && err.response.status === 404) {
            return { data: [] }
          }
          throw err
        })

        .then(({ data }) => {
          if (Array.isArray(data)) {
            originalBlingProduct = data.find(({ codigo }) => product.sku === String(codigo))
            if (!canCreateNew && !originalBlingProduct) {
              return null
            }
          }
          if (canCreateNew || appData.export_quantity || !blingStore) {
            const blingProduct = parseProduct(product, originalBlingProduct, blingProductCode, blingStore, appData)
            if (blingProduct) {
              const data = { produto: blingProduct }
              let endpoint = originalBlingProduct ? `/produtos/${blingProductId}` : '/produtos'
              if (originalBlingProduct) {
                return bling.put(endpoint, data)
              }
              return bling.post(endpoint, data)
            }
          }
          return null
        })

        .then(response => {
          if (!blingProductId) {
            const responseData = response.data && response.data.data
            if (responseData) {
              if (!metafields) {
                metafields = []
              }
              metafields.push({
                _id: ecomUtils.randomObjectId(),
                namespace: 'bling',
                field: 'bling:id',
                value: String(blingOrderNumber)
              })
              metafields.push({
                _id: ecomUtils.randomObjectId(),
                namespace: 'bling',
                field: 'bling:codigo',
                value: String(responseData.id)
              })
              appSdk.apiRequest(storeId, `/products/${productId}.json`, 'PATCH', {
                metafields
              }, auth)
                .catch(console.error)
            }
          }
          return response
        })
      handleJob({ appSdk, storeId }, queueEntry, job)
    })

    .catch(err => {
      if (err.response) {
        const { status } = err.response
        if (status >= 400 && status < 500) {
          const msg = `O produto ${productId} não existe (:${status})`
          const err = new Error(msg)
          err.isConfigError = true
          handleJob({ appSdk, storeId }, queueEntry, Promise.reject(err))
          return null
        }
      }
      errorHandling(err)
      throw err
    })
}
