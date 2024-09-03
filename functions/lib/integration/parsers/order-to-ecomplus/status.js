module.exports = situacao => {
  let financialStatus, fulfillmentStatus
  switch (situacao) {
    case 'venda agenciada':
    case 'aprovado':
    case 'pago':
      financialStatus = 'paid'
      break
    case 'em andamento':
    case 'em separação':
    case 'em separacao':
      fulfillmentStatus = 'in_separation'
      break
    case 'em produção':
    case 'em producao':
      fulfillmentStatus = 'in_production'
      break
    case 'faturado':
    case 'atendido':
    case 'nf emitida':
      fulfillmentStatus = 'invoice_issued'
      break
    case 'pronto para envio':
      fulfillmentStatus = 'ready_for_shipping'
      break
    case 'parte enviado':
      fulfillmentStatus = 'partially_shipped'
      break
    case 'enviado':
    case 'despachado':
      fulfillmentStatus = 'shipped'
      break
    case 'parte entregue':
      fulfillmentStatus = 'partially_delivered'
      break
    case 'entregue':
      fulfillmentStatus = 'delivered'
      break
    case 'cancelado':
      financialStatus = 'voided'
      break
    case 'aguardando troca':
      fulfillmentStatus = 'received_for_exchange'
      break
    case 'parte devolvido':
      fulfillmentStatus = 'partially_refunded'
      break
    case 'devolvido':
      fulfillmentStatus = 'refunded'
      break
    case 'retorno e troca':
      fulfillmentStatus = 'returned_for_exchange'
      break
    case 'parte pago':
      financialStatus = 'partially_paid'
      break
    case 'disputa':
      financialStatus = 'in_dispute'
      break
  }
  return { financialStatus, fulfillmentStatus }
}
