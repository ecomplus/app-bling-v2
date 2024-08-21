const { logger } = require('../../../context')

module.exports = async (blingAxios, order) => {
  const promise = []
  const codItems = order.items?.reduce((acc, item) => {
    acc.push(`/produtos?codigo=${item.sku}`)
    return acc
  }, [])

  codItems.forEach(url => {
    promise.push(
      blingAxios.get(url)
        .then(({ data }) => {
          if (data.data && data.data.length) {
            return data.data[0]
          }
        })
        .catch(err => {
          if (err.response) {
            logger.error(JSON.stringify(err.response.data))
          } else {
            logger.error(err)
          }
        })
    )
  })

  return Promise.all(promise)
    .then(response => {
      const list = []
      response.forEach((item) => {
        if (item) {
          list.push(item)
        }
      })
      return list
    })
}
