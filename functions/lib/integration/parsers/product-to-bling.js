const ecomUtils = require('@ecomplus/utils')

module.exports = (product, originalBlingProduct, blingProductCode, blingStore, appData) => {
  const hasVariations = product.variations && product.variations.length

  const blingProduct = {
    nome: product.name || '',
    codigo: product.sku || product._id,
    tipo: 'P',
    situacao: product.available && product.visible ? 'A' : 'I',
    formato: hasVariations ? 'V' : 'S',
    preco: ecomUtils.price(product),
    descricaoCurta: product.body_html || product.short_description,
    descricaoComplementar: product.short_description,
    unidade: originalBlingProduct && originalBlingProduct.unidade
      ? originalBlingProduct.unidade
      : product.measurement && product.measurement.unit !== 'oz' && product.measurement.unit !== 'ct'
        ? product.measurement.unit.substring(0, 6).toUpperCase()
        : 'UN'
  }

  if (product.condition) {
    blingProduct.condicao = 0
    if (product.condition === 'new') {
      blingProduct.condicao = 1
    } else if (product.condition === 'used') {
      blingProduct.condicao = 2
    }
  }
  if (product.min_quantity) {
    blingProduct.itensPorCaixa = product.min_quantity
  }

  const description = product.body_text || product.body_html
  if (description) {
    if (!blingProduct.descricaoCurta) {
      blingProduct.descricaoCurta = description
    } else {
      blingProduct.descricaoComplementar = description
    }
  } else if (!blingProduct.descricaoCurta) {
    blingProduct.descricaoCurta = product.name
  }


  if (product.mpn && product.mpn.length) {
    blingProduct.tributacao = {
      ncm: product.mpn[0]
    }
  }

  if (product.gtin && product.gtin.length) {
    blingProduct.gtin = product.gtin[0]
    if (product.gtin[1]) {
      blingProduct.gtinEmbalagem = product.gtin[1]
    }
  }

  if (product.weight && product.weight.value) {
    blingProduct.pesoBruto = product.weight.value
    switch (product.weight.unit) {
      case 'mg':
        blingProduct.pesoBruto /= 1000000
        break
      case 'g':
        blingProduct.pesoBruto /= 1000
    }
    blingProduct.pesoLiquido = blingProduct.pesoBruto
  }
  let dimensionUnit
  if (product.dimensions) {
    const blingProductDimensoes = {}
    for (const side in product.dimensions) {
      if (product.dimensions[side]) {
        const { value } = product.dimensions[side]
        if (value) {
          dimensionUnit = product.dimensions[side].unit
          const field = side === 'width'
            ? 'largura'
            : side === 'height' ? 'altura' : 'profundidade'
          blingProductDimensoes[field] = value
        }
      }
    }
    if (Object.keys(blingProductDimensoes).length) {
      blingProductDimensoes.unidadeMedida = dimensionUnit || 1
      blingProduct.dimensoes = blingProductDimensoes
    }
  }

  if (product.brands && product.brands.length) {
    blingProduct.marca = product.brands[0].name
  }
  if (product.videos && product.videos.length && product.videos[0].url) {
    blingProduct.midia = {
      videos: {
        url: product.videos[0].url
      }
    }
  }
  if (product.pictures && product.pictures.length) {
    blingProduct.imagens = {
      externas = []
    }
    product.pictures.forEach(({ zoom, big, normal }) => {
      const img = (zoom || big || normal)
      if (img) {
        blingProduct.imagens.externas.push({ link: img.url })
      }
    })
  }

  if (hasVariations) {
    blingProduct.variacoes = []

    product.variations.forEach((variation, i) => {
      const blingVariation = {
        nome: variation.name,
        variacao: {},
        tipo: 'P',
        situacao: product.available && product.visible ? 'A' : 'I',
        formato: 'S',
        codigo: variation.sku || `${product.sku}-${(i + 1)}`,
        preco: ecomUtils.price({ ...product, ...variation })
      }

      if (variation.mpn && variation.mpn.length) {
        blingVariation.tributacao = {
          ncm: variation.mpn[0]
        }
      }
    
      if (variation.gtin && variation.gtin.length) {
        blingVariation.gtin = variation.gtin[0]
        if (variation.gtin[1]) {
          blingVariation.gtinEmbalagem = variation.gtin[1]
        }
      }
    
      if (variation.weight && variation.weight.value) {
        blingVariation.pesoBruto = variation.weight.value
        switch (variation.weight.unit) {
          case 'mg':
            blingVariation.pesoBruto /= 1000000
            break
          case 'g':
            blingVariation.pesoBruto /= 1000
        }
        blingVariation.pesoLiquido = blingVariation
        blingVariation.pesoBruto
      }
      let variationDimensionUnit

      if (variation.dimensions) {
        const blingVationDimensoes = {}
        for (const side in variation.dimensions) {
          if (variation.dimensions[side]) {
            const { value } = variation.dimensions[side]
            if (value) {
              variationDimensionUnit = variation.dimensions[side].unit
              const field = side === 'width'
                ? 'largura'
                : side === 'height' ? 'altura' : 'profundidade'
                blingVationDimensoes[field] = value
            }
          }
        }
        if (Object.keys(blingVationDimensoes).length) {
          blingVationDimensoes.unidadeMedida = variationDimensionUnit || 1
          blingVariation.dimensoes = blingVationDimensoes
        }
      }

      if (!variation.dimensions) {
        blingVariation.produtoPai = {
          cloneInfo: true
        }
      }

      for (const gridId in variation.specifications) {
        const gridOptions = variation.specifications[gridId]
        if (gridOptions && gridOptions.length) {
          gridOptions.forEach(({ text }, i) => {
            let gridTitle
            switch (gridId) {
              case 'colors':
                gridTitle = 'Cor'
                break
              case 'size':
                gridTitle = 'Tamanho'
                break
              case 'age_group':
                gridTitle = 'Idade'
                break
              case 'gender':
                gridTitle = 'Gênero'
                break
              default:
                gridTitle = gridId.charAt(0).toUpperCase() + gridId.slice(1).replace('_', ' ')
            }
            if (blingVariation.nome) {
              blingVariation.variacao.nome += ';'
              blingProduct.variation.ordem = i + 1
              if (i > 0) {
                gridTitle += i === 1 ? ' secundária' : ` ${(i + 1)}`
              }
            }
            blingVariation.variacao.nome += `${gridTitle}:${text.replace(/[:;]/g, '')}`
          })
        }
      }
      blingProduct.variacoes.push(blingVariation)
    })
  }

  return blingProduct
}
