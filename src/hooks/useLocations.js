import { useState, useRef } from 'react'
import { readJson, writeJson } from '../utils/storage'
import { saveLocations } from '../utils/driveSync'

const LOCATIONS_KEY = 'qm_locations'
const TOMBSTONES_KEY = 'qm_locations_tombstones'
// Safety valve — if Drive's copy never catches up (e.g. the delete's save
// failed), stop masking the ID after this long so it can't hide forever.
const TOMBSTONE_TTL_MS = 5 * 60 * 1000

export function useLocations(token) {
  const [locations, setLocations] = useState(() => readJson(LOCATIONS_KEY, {}))
  const tombstonesRef = useRef(readJson(TOMBSTONES_KEY, {}))

  function commitLocations(next) {
    writeJson(LOCATIONS_KEY, next)
    setLocations(next)
    saveLocations(token, next)
  }

  function addPin(id, data) {
    commitLocations({ ...locations, [id]: data })
  }

  function removePin(id) {
    const next = { ...locations }
    delete next[id]
    tombstonesRef.current = { ...tombstonesRef.current, [id]: Date.now() }
    writeJson(TOMBSTONES_KEY, tombstonesRef.current)
    commitLocations(next)
  }

  // Drive wins on conflict (authoritative cross-device store), EXCEPT for pins
  // just deleted locally — removePin's Drive save is fire-and-forget, so a poll
  // already in flight (or firing right after) can still carry the pre-deletion
  // snapshot. Tombstones mask those IDs out of the incoming merge until Drive's
  // own copy confirms the deletion (the ID stops appearing in driveLocations).
  function mergeFromDrive(driveLocations) {
    const tombstones = tombstonesRef.current
    const now = Date.now()
    let tombstonesChanged = false
    for (const [id, deletedAt] of Object.entries(tombstones)) {
      const stillInDrive = driveLocations ? id in driveLocations : false
      const expired = now - deletedAt > TOMBSTONE_TTL_MS
      if (!stillInDrive || expired) {
        delete tombstones[id]
        tombstonesChanged = true
      }
    }
    if (tombstonesChanged) writeJson(TOMBSTONES_KEY, tombstones)

    if (driveLocations) {
      const filtered = { ...driveLocations }
      for (const id of Object.keys(tombstones)) delete filtered[id]
      setLocations(prev => {
        const merged = { ...prev, ...filtered }
        writeJson(LOCATIONS_KEY, merged)
        return merged
      })
    } else {
      const local = readJson(LOCATIONS_KEY, {})
      if (Object.keys(local).length > 0) saveLocations(token, local)
    }
  }

  return { locations, addPin, removePin, mergeFromDrive }
}
