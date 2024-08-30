/* eslint-disable promise/no-nesting */

const ecomUtils = require('@ecomplus/utils')
const { logger } = require('./../../context')
const errorHandling = require('../store-api/error-handling')
const Bling = require('../bling-auth/client')
const parseOrder = require('./parsers/order-to-bling/')
const parseStatus = require('./parsers/order-to-bling/status')
// const handleJob = require('./handle-job')
const url = require('url')
const getCustomerBling = require('./utils/get-customer-bling')
const getProductsBling = require('./utils/get-products-bling')

const getStatusBling = async (bling) => bling.get('/situacoes/modulos')
  .then(({ data: { data: modules } }) => {
    const salesModules = modules.find((module) => module.nome.toLowerCase() === 'vendas')
    if (salesModules) {
      return bling.get(`/situacoes/modulos/${salesModules.id}`)
        .then(({ data: { data: situacoes } }) => {
          return situacoes
        })
        // .catch(console.error)
    }
    return null
  })
  // .catch(console.error)

const getPaymentBling = async (blingAxios, transaction, appDataParsePayment) => {
  const {
    payment_method: paymentMethod
  } = transaction

  const namePaymentMethod = paymentMethod?.name?.toLowerCase()

  let parsePayment
  if (appDataParsePayment && appDataParsePayment.length) {
    parsePayment = appDataParsePayment.find(payment => payment.ecom_payment.toLowerCase() === namePaymentMethod)
  }
  // console.log(`forma: ${JSON.stringify(parsePayment)}`)

  if (!parsePayment) {
    const parsePaymentType = {
      credit_card: 3, // Cartão de Crédito
      debit_card: 4, // Cartão de Débito
      banking_billet: 15, // Boleto Bancário
      loyalty_points: 19, // Programa de Fidelidade, Cashback, Crédito Virtual
      account_deposit: 20, // Pagamento Instantâneo (PIX) – Estático
      other: 99 // Outros
    }
    const query = paymentMethod.code ? `?tiposPagamentos[]=${parsePaymentType[paymentMethod.code]}` : ''
    const formasPagamentos = await blingAxios.get(`/formas-pagamentos${query}`)
      .then(({ data }) => {
        if (!data.data?.length) {
          return blingAxios.get('/formas-pagamentos')
            .then(({ data }) => {
              return data.data && data.data[0]
            })
            // .catch(console.error)
        }
        return data.data[0]
      })
      // .catch(console.error)

    return formasPagamentos?.id
  }

  return parsePayment.bling_payment
}

module.exports = ({ appSdk, storeId, auth }, blingStore, blingDeposit, queueEntry, appData, canCreateNew) => {
  const orderId = queueEntry.nextId
  const {
    client_id: clientId,
    client_secret: clientSecret,
    bling_store: appDataBlingStore
  } = appData
  logger.info(`Try find Order id ${orderId}`)
  return appSdk.apiRequest(storeId, `/orders/${orderId}.json`, 'GET', null, auth)
    .then(async ({ response }) => {
      const order = response.data
      const transaction = order.transactions && order.transactions[0]
      const logHead = `#${storeId} ${orderId} `
      if (!order.financial_status) {
        logger.info(`${logHead}skipped with no financial status`)
        return null
      }

      let blingOrderNumber
      let blingOrderId
      let hasCreatedBlingOrder
      let { metafields } = order
      let metafieldId

      if (metafields) {
        metafieldId = metafields.find(({ field }) => field === 'bling:id')
        const metafieldNumber = metafields.find(({ field }) => field === 'bling:numero')
        blingOrderNumber = metafieldNumber?.value
        if (metafieldId) {
          blingOrderId = metafieldId.value
          if (blingOrderId === 'skip') {
            logger.info(`${logHead} skipped by metafield`)
            return null
          }
          hasCreatedBlingOrder = Boolean(blingOrderId)
        }
      }
      const urlParams = {
        numero: order.number
      }
      if (appData.random_order_number === true) {
        urlParams.numero = blingOrderNumber
      }

      if (appDataBlingStore || blingStore) {
        urlParams.idLoja = appDataBlingStore || blingStore
      }
      const params = new url.URLSearchParams(urlParams)
      const bling = new Bling(clientId, clientSecret, storeId)
      const endpoint = `/pedidos/vendas${hasCreatedBlingOrder ? `/${blingOrderId}` : `?${params.toString()}`}`
      const [paymentTypeId, allStatusBling] = await Promise.all([
        getPaymentBling(bling, transaction, appData.parse_payment),
        getStatusBling(bling)
      ])
      const job = bling.get(endpoint)
        .catch(err => {
          if (err.response && err.response.status === 404) {
            logger.warn(`Order Bling not found ${endpoint}`)
            return { data: {} }
          }
          throw err
        })
        .then(async ({ data: { data } }) => {
          // console.log('>start ')
          const blingStatus = parseStatus(order, appData)
          const hasFoundByNumber = Boolean(Array.isArray(data) && data.length)
          let originalBlingOrder
          if (hasFoundByNumber) {
            originalBlingOrder = data.find((pedido) => {
              if (String(order.number) === pedido.numeroLoja) {
                return !blingStore || (String(blingStore) === String(pedido.loja && pedido.loja.id))
              }
              return false
            })

            if (!originalBlingOrder && blingOrderNumber) {
              originalBlingOrder = data.find((pedido) => {
                return blingOrderNumber === String(pedido.numero)
              })
            }
          }
          if (originalBlingOrder) {
            blingOrderId = originalBlingOrder.id
            return { blingStatus }
          } else if (!canCreateNew) {
            if (canCreateNew === false || hasCreatedBlingOrder) {
              return {}
            }
          }

          if (!originalBlingOrder) {
            if (appData.approved_orders_only) {
              switch (blingStatus) {
                case 'pendente':
                case 'em aberto':
                case 'cancelado':
                  logger.info(`${logHead} skipped with status "${blingStatus}"`)
                  return {}
              }
            }
            if (!blingOrderNumber) {
              blingOrderNumber = (hasFoundByNumber || appData.random_order_number === true)
                ? String(Math.floor(Math.random() * (99999999 - 10000000)) + 10000000)
                : String(order.number)
            }

            const [customerIdBling, itemsBling] = await Promise.all([
              getCustomerBling(bling, appData, order),
              getProductsBling(bling, order)
            ])
            if (!customerIdBling) {
              logger.info('Bling Customer not found')
              throw new Error('Bling Customer not found')
            }

            if (order.items?.length !== itemsBling?.length) {
              logger.info('Bling Item(s) not found')
              throw new Error('Bling Item(s) not found')
            }

            const blingOrder = parseOrder(order, blingOrderNumber, blingStore, appData, customerIdBling, paymentTypeId, itemsBling)
            const endpoint = `/pedidos/vendas${blingOrderId ? `/${blingOrderId}` : ''}`
            const method = blingOrderId ? 'put' : 'post'
            logger.info(`[${method}]: ${endpoint} => ${JSON.stringify(blingOrder)}`)
            return bling[method](endpoint, blingOrder)
              .then(async ({ data: { data } }) => {
                logger.info(`Bling Order ${method === 'put' ? 'upd' : 'cre'}ated successfully`)
                if (data.id) {
                  blingOrderId = data.id
                  if (!metafields) {
                    metafields = []
                  }
                  if (!metafieldId) {
                    metafields.push({
                      _id: ecomUtils.randomObjectId(),
                      namespace: 'bling',
                      field: 'bling:id',
                      value: String(blingOrderId)
                    })
                  } else {
                    metafieldId.value = String(blingOrderId)
                  }

                  appSdk.apiRequest(storeId, `/orders/${order._id}.json`, 'PATCH', {
                    metafields
                  }, auth)
                }

                return { blingStatus }
              })
              .catch(err => {
                if (err.response) {
                  logger.warn(JSON.stringify(err.response.data))
                }
                logger.error(err)
              })
          }
          return {}
        })

        .then((response) => {
          const blingStatus = response?.blingStatus
          // console.log(` have status ${blingOrderId}: ${JSON.stringify(blingStatus)}`)
          if (blingOrderId) {
            const getParseStatusBling = (situacoes) => {
              let blingStatusObj

              const findBlingStatus = statusLabel => {
                blingStatusObj = situacoes.find((situacao) => {
                  return situacao.nome && situacao.nome.toLowerCase() === statusLabel?.toLowerCase()
                })
              }
              if (Array.isArray(blingStatus)) {
                for (let i = 0; i < blingStatus.length; i++) {
                  findBlingStatus(blingStatus[i])
                  if (blingStatusObj) {
                    break
                  }
                }
              } else {
                findBlingStatus(blingStatus)
              }
              return blingStatusObj
            }

            return bling.get(`/pedidos/vendas/${blingOrderId}`).then(async ({ data: { data } }) => {
              const situacao = data.situacao
              const newStatusBling = getParseStatusBling(allStatusBling)
              if (newStatusBling) {
                let blingStatusCurrent
                if (situacao) {
                  blingStatusCurrent = await bling.get(`/situacoes/${data.situacao.id}`)
                    .then(({ data: { data } }) => {
                      return getParseStatusBling([data])
                    })
                }

                // console.log(`=> status ${JSON.stringify(blingStatusCurrent)} => ${JSON.stringify(newStatusBling)}`)

                if (!blingStatusCurrent || blingStatusCurrent.nome !== newStatusBling.nome) {
                  return bling.patch(`/pedidos/vendas/${blingOrderId}/situacoes/${newStatusBling.id}`)
                    .then(() => logger.info('Bling order status updated successfully'))
                    .catch(err => {
                      if (err.response) {
                        logger.warn(JSON.stringify(err.response.data))
                      }
                      logger.error(err)
                    })
                }
                return null
              }
              const err = new Error('Sua conta Bling não tem "situacoes" cadastradas ou a API do Bling falhou')
              err.isConfigError = true
              throw err
            })
          }
          return null
        })
      // handleJob({ appSdk, storeId }, queueEntry, job)
      return job
    })

    .catch(err => {
      if (err.response) {
        const { status } = err.response
        if (status >= 400 && status < 500) {
          const msg = `O pedido ${orderId} não existe (:${status})`
          const err = new Error(msg)
          err.isConfigError = true
          // handleJob({ appSdk, storeId }, queueEntry, Promise.reject(err))
          return err
        }
      }
      errorHandling(err)
      throw err
    })
}
