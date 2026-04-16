const fs = require('fs')
const util = require('util')
const path = require('path')
const readFile = util.promisify(fs.readFile)

async function readJson(relativePath) {
  const buf = await readFile(path.join(__dirname, relativePath))
  return JSON.parse(buf.toString('utf8'))
}

module.exports = async function () {
  const [groupConfig, unitsShow, dataset] = await Promise.all([
    readJson('../data/unitsShowGroups.json'),
    readJson('../data/unitsShow.json'),
    readJson('../data.json'),
  ])

  const catchAllGroups = groupConfig.filter((group) => group.catchAll)
  if (catchAllGroups.length !== 1) {
    throw new Error('unitsShowGroups.json must contain exactly one catchAll group')
  }

  const catchAllKey = catchAllGroups[0].key
  const unitsByName = new Map(dataset.units.map((unit) => [unit.name, unit]))
  const unitsShowSet = new Set(unitsShow)
  const groupedUnits = groupConfig.map((group) => ({
    key: group.key,
    name: group.name,
    collapsed: group.collapsed,
    units: [],
  }))
  const groupedUnitsByKey = new Map(groupedUnits.map((group) => [group.key, group]))
  const assignedUnits = new Map()

  for (const group of groupConfig) {
    for (const unitName of group.units) {
      if (!unitsShowSet.has(unitName)) {
        throw new Error(`Configured unit "${unitName}" is not present in unitsShow.json`)
      }
      if (!unitsByName.has(unitName)) {
        throw new Error(`Configured unit "${unitName}" is not present in data.json`)
      }
      if (assignedUnits.has(unitName)) {
        throw new Error(
          `Configured unit "${unitName}" is assigned to both "${assignedUnits.get(unitName)}" and "${group.key}"`
        )
      }

      groupedUnitsByKey.get(group.key).units.push(unitsByName.get(unitName))
      assignedUnits.set(unitName, group.key)
    }
  }

  for (const unitName of unitsShow) {
    if (assignedUnits.has(unitName)) {
      continue
    }
    if (!unitsByName.has(unitName)) {
      throw new Error(`Unit "${unitName}" from unitsShow.json is not present in data.json`)
    }

    groupedUnitsByKey.get(catchAllKey).units.push(unitsByName.get(unitName))
    assignedUnits.set(unitName, catchAllKey)
  }

  return groupedUnits
}
