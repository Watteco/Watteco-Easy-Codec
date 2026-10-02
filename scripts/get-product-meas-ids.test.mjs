import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolveMeasIds, run } from './get-product-meas-ids.mjs'

test('resout les measIds de Pulse Sens\'O Neo depuis les fichiers du projet', async () => {
  const result = await run(['50-70-260'])

  assert.equal(result.product, '50-70-260-PulseSensoNeoTest')
  assert.deepEqual(result.mIds, ['pulse-senso-neo'])
  assert.ok(result.models.includes('pulse-senso-neo'))
  assert.ok(result.models.includes('binary-input'))
  assert.ok(result.measIds.includes(135))
  assert.equal(new Set(result.measIds).size, result.measIds.length)
})

test('accepte plusieurs mId et dedoublonne les measId', () => {
  const mapping = [
    '##models;',
    'name;selectors',
    'model-a;{mId: first}',
    'model-b;{mId: second}',
    '##objects;',
    'id;models;measId',
    'object-a;model-a;10',
    'object-b;model-b;20',
    'object-bis;model-b;20',
    'object-c;unrelated;30',
  ].join('\n')

  const result = resolveMeasIds('50-70-999', {
    products: [{ file: '50-70-999-Test', mId: ['first', 'second'] }],
  }, mapping)

  assert.deepEqual(result.measIds, [10, 20])
})

test('rejette une reference produit absente', async () => {
  const products = JSON.parse(await readFile(new URL('../public/config/AvailableProductList.json', import.meta.url), 'utf8'))
  const mapping = await readFile(new URL('../src/config/watteco-bacnet-mapping.csv', import.meta.url), 'utf8')

  assert.throws(
    () => resolveMeasIds('50-70-000', products, mapping),
    /Produit 50-70-000 introuvable/,
  )
})
