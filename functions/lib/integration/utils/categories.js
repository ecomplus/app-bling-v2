const getCategories = async (blingAxios, blingStore) => blingAxios.get(`/categorias/lojas?idLoja=${blingStore}`)

const getSpecificCategory = async (blingAxios, id) => blingAxios.get(`/categorias/lojas/${id}`)

const postCategory = async (blingAxios, body) => blingAxios.put('/categorias/lojas', body)

module.exports = {
  getCategories,
  getSpecificCategory,
  postCategory
}
