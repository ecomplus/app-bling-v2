const getCustomerBling = async (blingAxios, docNumber) => blingAxios.get(`/contatos?limite=1&pesquisa=${docNumber}`)

const createCustomerBling = async (blingAxios, body) => blingAxios.put('/contatos', body)

module.exports = {
  getCustomerBling,
  createCustomerBling
}
