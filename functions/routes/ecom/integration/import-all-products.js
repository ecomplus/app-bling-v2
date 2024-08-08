const updateAppData = require('../../../lib/store-api/update-app-data')
const createAxios = require('../../../lib/bling-auth/create-axios')
const { logger } = require('./../../../context')

exports.get = async ({ appSdk, admin }, req, res) => {
  const { storeId } = req
  const blingToken = req.query.bling_token
  const blingStore = req.query.bling_store
  const blingOffsetPage = parseInt(req.query.bling_offset_page, 10) || 1

  if (typeof blingToken === 'string' && blingToken) {
    const bling = createAxios(blingToken)
    let countBlingReqs = 0
    const skus = []

    const listNextBlingProducts = page => {
      let endpoint = '/produtos'
      if (page > 1) {
        endpoint += `/page=${page}`
      }
      logger.info(`> #${storeId} import all [page ${page}]`)

      setTimeout(() => {
        countBlingReqs++
        bling.get(endpoint, {
          params: {
            tipo: 'P',
            loja: blingStore
          }
        })

          .then(({ data }) => {
            if (Array.isArray(data.produtos)) {
              data.produtos.forEach(({ produto }) => {
                if (!produto.codigoPai) {
                  const sku = String(produto.codigo)
                  if (sku && !skus.includes(sku)) {
                    skus.push(sku)
                  }
                }
              })
              if (data.produtos.length === 100 && skus.length < 3000) {
                return listNextBlingProducts(page + 1)
              }
            }
            if (skus.length) {
              logger.info(`> #${storeId} all SKUs: ${JSON.stringify(skus)}`)
              return updateAppData({ appSdk, storeId }, {
                importation: { skus }
              })
            }
          })
          .catch(logger.error)
      }, countBlingReqs * 500)
    }

    listNextBlingProducts(blingOffsetPage)
    return res.sendStatus(201)
  }

  res.sendStatus(403)
}
