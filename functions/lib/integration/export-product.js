const ecomUtils = require('@ecomplus/utils')
const ecomClient = require('@ecomplus/client')
const { logger } = require('./../../context')
const errorHandling = require('../store-api/error-handling')
const Bling = require('../bling-auth/client')
const parseProduct = require('./parsers/product-to-bling')
const handleJob = require('./handle-job')
const url = require('url')

const getBlingStockId = (blingApi, blingProductId) => {
  const urlParams = {
    'idsProdutos[]': blingProductId
  }

  const params = new url.URLSearchParams(urlParams)
  return blingApi.get(`/estoques/saldos?${params.toString()}`).then(({ data }) => {
    const depositos = data?.data.length && data?.data[0].depositos
    if (depositos && depositos.length) {
      return depositos[0].id
    }
  }).catch(console.error)
}

module.exports = ({ appSdk, storeId, auth }, blingStore, _blingDeposit, queueEntry, appData, canCreateNew) => {
  const productId = queueEntry.nextId
  logger.info(`>> export products to bling ${productId}`)
  const { client_id: clientId, client_secret: clientSecret } = appData
  return ecomClient.store({
    storeId,
    url: `/products/${productId}.json`
  })

    .then(async ({ data }) => {
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
      // Bling Requests
      const blingApi = new Bling(clientId, clientSecret, storeId)

      const job = blingApi.get('/produtos', {
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

        .then(async ({ data: { data: blingProducts } }) => {
          if (blingProducts && Array.isArray(blingProducts)) {
            originalBlingProduct = blingProducts.find(({ codigo }) => product.sku === String(codigo))

            // Check blingProductId and update
            blingProductId = !blingProductId && originalBlingProduct ? originalBlingProduct.id : blingProductId

            if (!canCreateNew && !originalBlingProduct) {
              return null
            }
          }
          if (canCreateNew || appData.export_quantity || !blingStore) {
            if (originalBlingProduct) {
              originalBlingProduct = await blingApi.get(`/produtos/${blingProductId}`)
                .then(({ data: { data: productBling } }) => productBling)
            }
            const blingProduct = parseProduct(product, originalBlingProduct, blingProductCode, blingStore, appData)
            logger.info('>body ', JSON.stringify(blingProduct))
            if (blingProduct) {
              const endpoint = originalBlingProduct ? `/produtos/${blingProductId}` : '/produtos'
              if (originalBlingProduct) {
                // TODO: remove debug
                logger.info('>> Put Bling ', endpoint)

                // TODO: it isn't updating stock. Why?
                return blingApi.put(endpoint, blingProduct)
              }
              // TODO: remove debug
              logger.info('>> Post Bling')
              return blingApi.post(endpoint, blingProduct)
            }
          }
          return null
        })

        .then(async (response) => {
          let estoqueId = (metafields.find(({ field }) => field === 'bling:estoqueId'))?.value
          if (!originalBlingProduct) {
            const responseData = response.data && response.data.data
            if (responseData) {
              blingProductId = String(responseData.id)

              if (!metafields) {
                metafields = []
              }

              estoqueId = await getBlingStockId(blingApi, blingProductId)

              if (estoqueId) {
                metafields.push({
                  _id: ecomUtils.randomObjectId(),
                  namespace: 'bling',
                  field: 'bling:estoqueId',
                  value: String(estoqueId)
                })
              }

              if (blingProductCode) {
                metafields.push({
                  _id: ecomUtils.randomObjectId(),
                  namespace: 'bling',
                  field: 'bling:codigo',
                  value: String(blingProductCode)
                })
              }

              metafields.push({
                _id: ecomUtils.randomObjectId(),
                namespace: 'bling',
                field: 'bling:id',
                value: blingProductId
              })

              appSdk.apiRequest(
                storeId,
                `products/${productId}.json`,
                'PATCH',
                { metafields },
                auth
              ).catch(logger.error)
            }
          } else if (appData.export_quantity && !estoqueId) {
            estoqueId = await getBlingStockId(blingApi, blingProductId)
            if (estoqueId) {
              metafields.push({
                _id: ecomUtils.randomObjectId(),
                namespace: 'bling',
                field: 'bling:estoqueId',
                value: String(estoqueId)
              })

              appSdk.apiRequest(
                storeId,
                `products/${productId}.json`,
                'PATCH',
                { metafields },
                auth
              ).catch(logger.error)
            }
          }

          const hasVariations = product.variations && product.variations.length
          // TODO: handle stock if exists variations

          const blingQuantity = originalBlingProduct?.quantity
          const productQuantity = !hasVariations ? product?.quantity : 0
          const isUpdateStock = (appData.export_quantity || !originalBlingProduct) &&
            (!hasVariations ? blingQuantity !== productQuantity : false)
          logger.info(`> Update stock ${isUpdateStock} estoqueId: ${JSON.stringify(estoqueId)}`)

          if (isUpdateStock && estoqueId) {
            const bodyStock = {
              produto: {
                id: Number(blingProductId)
              },
              deposito: {
                id: Number(estoqueId)
              },
              operacao: 'B',
              quantidade: productQuantity,
              observacoes: `Update in ${new Date().toISOString()}`
            }

            await blingApi.post('/estoques', bodyStock)
              .catch(logger.error)
          }

          return response
        })
        // TODO: remove debug
        .catch(err => {
          const data = err.response?.data
          if (data) {
            logger.warn(data)
            logger.error(err.response)
          } else {
            logger.error(err)
          }
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
