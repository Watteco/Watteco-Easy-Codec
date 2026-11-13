import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const defaultProductsUrl = new URL('../public/config/AvailableProductList.json', import.meta.url)
const defaultMappingUrl = new URL('../src/config/watteco-bacnet-mapping.csv', import.meta.url)

function parseCsvLine(line) {
  const cells = []
  let cell = ''
  let quoted = false

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        cell += '"'
        index += 1
      } else {
        quoted = !quoted
      }
    } else if (character === ';' && !quoted) {
      cells.push(cell)
      cell = ''
    } else {
      cell += character
    }
  }

  cells.push(cell)
  return cells
}

function getSection(lines, marker) {
  const start = lines.findIndex((line) => line.trim().startsWith(`##${marker}`))
  if (start === -1) {
    throw new Error(`Table ##${marker} introuvable dans le fichier de mapping`)
  }

  const end = lines.findIndex((line, index) => index > start && line.trim().startsWith('##'))
  const sectionLines = lines.slice(start + 1, end === -1 ? undefined : end)
  if (sectionLines.length === 0) {
    throw new Error(`Table ##${marker} vide dans le fichier de mapping`)
  }

  const headers = parseCsvLine(sectionLines[0]).map((header) => header.trim())
  return sectionLines
    .slice(1)
    .filter((line) => line.trim() !== '')
    .map((line) => Object.fromEntries(headers.map((header, index) => [header, parseCsvLine(line)[index] ?? ''])))
}

function normalizeReference(reference) {
  return reference.trim().toLowerCase()
}

function productHasReference(product, reference) {
  const normalized = normalizeReference(reference)
  const fields = [product.file, product.name].filter((value) => typeof value === 'string')
  return fields.some((field) => {
    const candidate = field.toLowerCase()
    const index = candidate.indexOf(normalized)
    if (index === -1) return false

    const before = candidate[index - 1]
    const after = candidate[index + normalized.length]
    return !/[0-9]/.test(before ?? '') && !/[0-9]/.test(after ?? '')
  })
}

export function findProduct(products, reference) {
  const matches = products.filter((product) => productHasReference(product, reference))
  if (matches.length === 0) {
    throw new Error(`Produit ${reference} introuvable dans AvailableProductList.json`)
  }
  if (matches.length > 1) {
    throw new Error(`Reference ${reference} ambigue : ${matches.map((product) => product.file ?? product.name).join(', ')}`)
  }
  return matches[0]
}

export function resolveMeasIds(productReference, productList, mappingSource) {
  const products = Array.isArray(productList) ? productList : productList.products
  if (!Array.isArray(products)) {
    throw new Error('Le JSON produit doit contenir un tableau "products"')
  }

  const product = findProduct(products, productReference)
  const mIds = (Array.isArray(product.mId) ? product.mId : [product.mId])
    .filter((mId) => typeof mId === 'string' && mId.trim() !== '')
    .map((mId) => mId.trim())

  if (mIds.length === 0) {
    throw new Error(`Aucun mId renseigne pour le produit ${productReference}`)
  }

  const lines = mappingSource.replace(/^\uFEFF/, '').split(/\r?\n/)
  const models = getSection(lines, 'models')
  const objects = getSection(lines, 'objects')
  const selectedModels = new Set()

  for (const model of models) {
    const selectorMIds = [...model.selectors.matchAll(/\{\s*mId\s*:\s*([^}]+?)\s*\}/g)]
      .map((match) => match[1].trim())
    if (mIds.some((mId) => selectorMIds.includes(mId))) {
      selectedModels.add(model.name.trim())
    }
  }

  const measIds = objects
    .filter((object) => object.models
      .split(',')
      .map((model) => model.trim())
      .some((model) => selectedModels.has(model)))
    .map((object) => object.measId.trim())
    .filter((measId) => measId !== '')
    .map((measId) => /^\d+$/.test(measId) ? Number(measId) : measId)

  return {
    product: product.file ?? product.name,
    mIds,
    models: [...selectedModels],
    measIds: [...new Set(measIds)],
  }
}

function parseArguments(args) {
  const options = { products: defaultProductsUrl, mapping: defaultMappingUrl }
  let reference

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    if (argument === '--products' || argument === '--mapping') {
      const path = args[index + 1]
      if (!path) throw new Error(`Valeur manquante apres ${argument}`)
      options[argument.slice(2)] = path
      index += 1
    } else if (!reference) {
      reference = argument
    } else {
      throw new Error(`Argument inconnu : ${argument}`)
    }
  }

  if (!reference) {
    throw new Error('Usage : node scripts/get-product-meas-ids.mjs <50-70-...> [--products chemin.json] [--mapping chemin.csv]')
  }
  return { reference, ...options }
}

export async function run(args) {
  const { reference, products, mapping } = parseArguments(args)
  const [productSource, mappingSource] = await Promise.all([
    readFile(products, 'utf8'),
    readFile(mapping, 'utf8'),
  ])
  return resolveMeasIds(reference, JSON.parse(productSource), mappingSource)
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMainModule) {
  run(process.argv.slice(2)).then((result) => {
    console.log(JSON.stringify(result.measIds, null, 2))
  }).catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}
