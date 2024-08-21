const ecomUtils = require('@ecomplus/utils')
// const parseAddress = require('./parsers/address-to-bling')

// const formatDate = date => {
//   const d = new Date(date.getTime() - (3 * 60 * 60 * 1000))
//   return d.getDate().toString().padStart(2, '0') + '/' +
//     (d.getMonth() + 1).toString().padStart(2, '0') + '/' +
//     d.getFullYear()
// }

module.exports = (order, _blingOrderNumber, blingStore, appData, customerIdBling, paymentTypeId, itemsBling) => {
  // TODO: Shipping
  try {
    // const {
    //   parse_payment: parsePayment,
    //   parse_shipping: parseShipping,
    //   parse_status: parseStatus
    // } = appData
    const { amount } = order

    const blingOrder = {
      numeroLoja: String(order.number),
      data: (order.opened_at || order.created_at).substring(0, 10),
      numeroPedidoCompra: order._id,
      contato: { id: customerIdBling }
    }
    if (order.number && !appData.disable_order_number) {
      blingOrder.numero = /* appData.random_order_number === true ? blingOrderNumber : */ order.number
    }
    if (blingStore) {
      blingOrder.loja = {
        id: Number(blingStore)
      }
    }

    // // const buyer = order.buyers && order.buyers[0]
    const shippingLine = order.shipping_lines && order.shipping_lines[0]
    const transaction = order.transactions && order.transactions[0]
    // const shippingAddress = shippingLine && shippingLine.to
    // // const billingAddress = transaction && transaction.billing_address

    // console.log(`order transaction: ${JSON.stringify(transaction)}`)
    // let notesForCustomization = ''
    if (order.items && order.items.length) {
      blingOrder.itens = []
      order.items.forEach(item => {
        // console.log(`itemsBling: ${JSON.stringify(itemsBling)}`)
        if (item.quantity) {
          const itemRef = (item.sku || item._id).substring(0, 40)
          const itemToBling = {
            codigo: itemRef,
            descricao: item.name ? item.name.substring(0, 120) : itemRef,
            unidade: 'Un',
            quantidade: item.quantity,
            valor: ecomUtils.price(item)
          }
          const productBlingId = (itemsBling.find(itemBling => itemBling?.codigo === item?.sku))?.id
          if (productBlingId) {
            Object.assign(itemToBling, { produto: { id: productBlingId } })
          }
          blingOrder.itens.push(itemToBling)
          // if (item.customizations && item.customizations.length) {
          //   item.customizations.forEach(customization => {
          //     notesForCustomization += `${customization.label} ${customization.option && customization.option.text} - ${item.sku}`
          //   })
          // }
        }
      })
    }

    if (transaction) {
      let blingPaymentLabel = ''
      if (order.payment_method_label) {
        blingPaymentLabel = order.payment_method_label
      } else if (transaction.payment_method.name) {
        blingPaymentLabel = transaction.payment_method.name.substring(0, 140)
      }
      blingOrder.parcelas = []
      if (transaction.installments) {
        const { number } = transaction.installments
        const extra = amount.extra || 0
        const vlr = (amount.total - extra) / number
        const date = new Date(blingOrder.data).getTime()
        for (let i = 0; i < number; i++) {
          const addDaysMs = i ? (i * 30 * 24 * 60 * 60 * 1000) : 0
          const deadLine = new Date(date + addDaysMs)
          blingOrder.parcelas.push({
            dataVencimento: deadLine.substring(0, 10),
            valor: vlr,
            observacoes: `${blingPaymentLabel} (${(i + 1)}/${number})`,
            formaPagamento: { id: paymentTypeId }
          })
        }
      } else {
        blingOrder.parcelas.push({
          dataVencimento: blingOrder.data,
          valor: amount.total,
          observacoes: `${blingPaymentLabel} (1/1)`,
          formaPagamento: { id: paymentTypeId }
        })
      }
    }

    if (shippingLine) {
      blingOrder.transporte = {}
      // if (shippingLine.app) {
      //   const { carrier } = shippingLine.app
      //   if (carrier) {
      //     blingOrder.transporte.transportadora = carrier
      //     if (shippingLine.app.service_name) {
      //       if (/correios/i.test(carrier) || /(pac|sedex)/i.test(shippingLine.app.service_name)) {
      //         blingOrder.transporte.servico_correios = shippingLine.app.service_name
      //       }
      //     }
      //   }
      //   if (!blingOrder.transporte.servico_correios && shippingLine.app.label) {
      //     blingOrder.transporte.servico_correios = shippingLine.app.label
      //   }
      //   if (!blingOrder.transporte.transportadora && shippingLine.app.label) {
      //     blingOrder.transporte.transportadora = shippingLine.app.label
      //   }
      // }
      // if (!blingOrder.transporte.transportadora && order.shipping_method_label) {
      //   blingOrder.transporte.transportadora = order.shipping_method_label
      // }
      if (shippingLine.package && shippingLine.package.weight) {
        const { unit, value } = shippingLine.package.weight
        blingOrder.transporte.pesoBruto = unit === 'g'
          ? value / 1000
          : unit === 'mg'
            ? value / 1000000
            : value
      }

      // if (shippingAddress) {
      //   blingOrder.transporte.dados_etiqueta = {}
      //   parseAddress(shippingAddress, blingOrder.transporte.dados_etiqueta, 'municipio')
      // }
    }

    if (typeof amount.freight === 'number') {
      if (!(blingOrder.transporte && Object.keys(blingOrder.transporte).length)) {
        blingOrder.transporte = {}
      }
      // if (!blingOrder.taxas) blingOrder.taxas = {}
      // if (!blingOrder.taxas.custoFrete) blingOrder.taxas.custoFrete = amount.freight
      blingOrder.transporte.frete = amount.freight
      // if (amount.tax) {
      //   blingOrder.transporte.frete += amount.tax
      // }
    }

    if (amount.discount) {
      blingOrder.desconto = {
        valor: amount.discount,
        unidade: 'REAL'
      }
    }
    if (amount.balance) {
      if (!(blingOrder.desconto && blingOrder.desconto.valor)) {
        blingOrder.desconto = {
          valor: 0,
          unidade: 'REAL'
        }
      }
      blingOrder.desconto.valor += amount.balance
    }

    if (order.notes) {
      blingOrder.observacoes = order.notes
    }
    // if (!blingOrder.obs && notesForCustomization.length) {
    //   blingOrder.obs = notesForCustomization
    // } else if (blingOrder.obs && notesForCustomization.length) {
    //   blingOrder.obs += ` ${notesForCustomization}`
    // }
    // if (order.staff_notes) {
    //   blingOrder.obs_internas = order.staff_notes.substring(0, 250)
    // }

    // if (appData.bling_order_data) {
    //   for (const field in appData.bling_order_data) {
    //     let value = appData.bling_order_data[field]
    //     switch (value) {
    //       case undefined:
    //       case '':
    //       case null:
    //         break
    //       default:
    //         if (typeof value === 'string') {
    //           value = value.trim()
    //           if (value) {
    //             blingOrder[field] = value
    //           }
    //         } else {
    //           blingOrder[field] = value
    //         }
    //     }
    //   }
    // }

    return blingOrder
  } catch (err) {
    console.error(err)
  }
}
