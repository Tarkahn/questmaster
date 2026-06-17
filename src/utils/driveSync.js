const DRIVE = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3'
const FILE_NAME = 'questmaster-habits.json'
const FILE_ID_KEY = 'qm_drive_file_id'
const GLOSSARY_FILE_NAME = 'questmaster-glossary.txt'
const GLOSSARY_FILE_ID_KEY = 'qm_drive_glossary_id'
const DIFFICULTIES_FILE_NAME = 'questmaster-difficulties.json'
const DIFFICULTIES_FILE_ID_KEY = 'qm_drive_diff_id'
const SETTINGS_FILE_NAME = 'questmaster-settings.json'
const SETTINGS_FILE_ID_KEY = 'qm_drive_settings_id'

function auth(token) {
  return { Authorization: `Bearer ${token}` }
}

function getCachedId() {
  return localStorage.getItem(FILE_ID_KEY)
}

function setCachedId(id) {
  if (id) localStorage.setItem(FILE_ID_KEY, id)
  else localStorage.removeItem(FILE_ID_KEY)
}

async function findFileId(token) {
  const params = new URLSearchParams({
    spaces: 'appDataFolder',
    q: `name='${FILE_NAME}'`,
    fields: 'files(id)',
    orderBy: 'createdTime',
  })
  const res = await fetch(`${DRIVE}/files?${params}`, { headers: auth(token) })
  if (!res.ok) {
    const status = res.status
    throw Object.assign(new Error(`Drive list failed: ${status}`), { status })
  }
  const data = await res.json()
  return data.files?.[0]?.id || null
}

// Always resolve by name (oldest match) so every device converges on the SAME
// file, even if duplicates exist in appDataFolder from earlier sessions.
// (A stale per-device cached ID is exactly what split devices onto separate files.)
async function getFileId(token) {
  const id = await findFileId(token)
  setCachedId(id)
  return id
}

// Returns { habits, difficulties, error }
// File format: {habits: [...], difficulties: {...}} or legacy plain array
export async function loadFromDrive(token) {
  try {
    let fileId = await getFileId(token)
    if (!fileId) return { habits: null, difficulties: null, error: null }

    const res = await fetch(`${DRIVE}/files/${fileId}?alt=media`, { headers: auth(token) })

    if (res.status === 404) {
      setCachedId(null)
      return { habits: null, difficulties: null, error: null }
    }
    if (!res.ok) {
      const status = res.status
      throw Object.assign(new Error(`Drive read failed: ${status}`), { status })
    }

    const raw = await res.json()

    // Legacy format: plain array (habits only)
    if (Array.isArray(raw)) {
      return { habits: raw, difficulties: null, error: null }
    }

    return {
      habits: Array.isArray(raw.habits) ? raw.habits : null,
      difficulties: raw.difficulties && typeof raw.difficulties === 'object' ? raw.difficulties : null,
      error: null,
    }

  } catch (e) {
    const status = e.status
    if (status === 401 || status === 403) return { habits: null, difficulties: null, error: 'scope' }
    return { habits: null, difficulties: null, error: 'network' }
  }
}

async function findGlossaryFileId(token) {
  const params = new URLSearchParams({
    spaces: 'appDataFolder',
    q: `name='${GLOSSARY_FILE_NAME}'`,
    fields: 'files(id)',
    orderBy: 'createdTime',
  })
  const res = await fetch(`${DRIVE}/files?${params}`, { headers: auth(token) })
  if (!res.ok) throw Object.assign(new Error(`Drive list failed: ${res.status}`), { status: res.status })
  const data = await res.json()
  return data.files?.[0]?.id || null
}

async function getGlossaryFileId(token) {
  const id = await findGlossaryFileId(token)
  if (id) localStorage.setItem(GLOSSARY_FILE_ID_KEY, id)
  return id
}

export async function loadGlossary(token) {
  try {
    const fileId = await getGlossaryFileId(token)
    if (!fileId) return { text: null, error: null }

    const res = await fetch(`${DRIVE}/files/${fileId}?alt=media`, { headers: auth(token) })
    if (res.status === 404) {
      localStorage.removeItem(GLOSSARY_FILE_ID_KEY)
      return { text: null, error: null }
    }
    if (!res.ok) throw Object.assign(new Error(`Drive read failed: ${res.status}`), { status: res.status })

    const text = await res.text()
    return { text, error: null }
  } catch (e) {
    const status = e.status
    if (status === 401 || status === 403) return { text: null, error: 'scope' }
    return { text: null, error: 'network' }
  }
}

export async function saveGlossary(token, text) {
  try {
    let fileId = await getGlossaryFileId(token)

    if (fileId) {
      const res = await fetch(`${UPLOAD}/files/${fileId}?uploadType=media`, {
        method: 'PATCH',
        headers: { ...auth(token), 'Content-Type': 'text/plain' },
        body: text,
      })
      if (res.status === 404) {
        localStorage.removeItem(GLOSSARY_FILE_ID_KEY)
        return saveGlossary(token, text)
      }
    } else {
      const boundary = 'qm_boundary_002'
      const metadata = JSON.stringify({ name: GLOSSARY_FILE_NAME, parents: ['appDataFolder'] })
      const multipart = [
        `--${boundary}`,
        'Content-Type: application/json; charset=UTF-8',
        '',
        metadata,
        `--${boundary}`,
        'Content-Type: text/plain',
        '',
        text,
        `--${boundary}--`,
      ].join('\r\n')

      const res = await fetch(`${UPLOAD}/files?uploadType=multipart`, {
        method: 'POST',
        headers: {
          ...auth(token),
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipart,
      })

      if (res.ok) {
        const data = await res.json()
        if (data.id) localStorage.setItem(GLOSSARY_FILE_ID_KEY, data.id)
      }
    }
  } catch {
    // localStorage remains the fallback
  }
}

async function findDiffFileId(token) {
  const params = new URLSearchParams({
    spaces: 'appDataFolder',
    q: `name='${DIFFICULTIES_FILE_NAME}'`,
    fields: 'files(id)',
    orderBy: 'createdTime',
  })
  const res = await fetch(`${DRIVE}/files?${params}`, { headers: auth(token) })
  if (!res.ok) throw Object.assign(new Error(`Drive list failed: ${res.status}`), { status: res.status })
  const data = await res.json()
  return data.files?.[0]?.id || null
}

async function getDiffFileId(token) {
  const id = await findDiffFileId(token)
  if (id) localStorage.setItem(DIFFICULTIES_FILE_ID_KEY, id)
  return id
}

export async function loadDifficulties(token) {
  try {
    const fileId = await getDiffFileId(token)
    if (!fileId) return { memory: null, error: null }

    const res = await fetch(`${DRIVE}/files/${fileId}?alt=media`, { headers: auth(token) })
    if (res.status === 404) {
      localStorage.removeItem(DIFFICULTIES_FILE_ID_KEY)
      return { memory: null, error: null }
    }
    if (!res.ok) throw Object.assign(new Error(`Drive read failed: ${res.status}`), { status: res.status })

    const memory = await res.json()
    return { memory: typeof memory === 'object' ? memory : null, error: null }
  } catch (e) {
    const status = e.status
    if (status === 401 || status === 403) return { memory: null, error: 'scope' }
    return { memory: null, error: 'network' }
  }
}

// Returns { ok: boolean, status?: number }
export async function saveDifficulties(token, memory) {
  try {
    const body = JSON.stringify(memory)
    let fileId

    try {
      fileId = await getDiffFileId(token)
    } catch (e) {
      return { ok: false, status: e.status }
    }

    if (fileId) {
      const res = await fetch(`${UPLOAD}/files/${fileId}?uploadType=media`, {
        method: 'PATCH',
        headers: { ...auth(token), 'Content-Type': 'application/json' },
        body,
      })
      if (res.status === 404) {
        localStorage.removeItem(DIFFICULTIES_FILE_ID_KEY)
        return saveDifficulties(token, memory)
      }
      return { ok: res.ok, status: res.status }
    } else {
      const boundary = 'qm_boundary_003'
      const metadata = JSON.stringify({ name: DIFFICULTIES_FILE_NAME, parents: ['appDataFolder'] })
      const multipart = [
        `--${boundary}`,
        'Content-Type: application/json; charset=UTF-8',
        '',
        metadata,
        `--${boundary}`,
        'Content-Type: application/json',
        '',
        body,
        `--${boundary}--`,
      ].join('\r\n')

      const res = await fetch(`${UPLOAD}/files?uploadType=multipart`, {
        method: 'POST',
        headers: { ...auth(token), 'Content-Type': `multipart/related; boundary=${boundary}` },
        body: multipart,
      })
      if (res.ok) {
        const data = await res.json()
        if (data.id) localStorage.setItem(DIFFICULTIES_FILE_ID_KEY, data.id)
      }
      return { ok: res.ok, status: res.status }
    }
  } catch {
    return { ok: false }
  }
}

async function findSettingsFileId(token) {
  const params = new URLSearchParams({
    spaces: 'appDataFolder',
    q: `name='${SETTINGS_FILE_NAME}'`,
    fields: 'files(id)',
    orderBy: 'createdTime',
  })
  const res = await fetch(`${DRIVE}/files?${params}`, { headers: auth(token) })
  if (!res.ok) throw Object.assign(new Error(`Drive list failed: ${res.status}`), { status: res.status })
  const data = await res.json()
  return data.files?.[0]?.id || null
}

async function getSettingsFileId(token) {
  const id = await findSettingsFileId(token)
  if (id) localStorage.setItem(SETTINGS_FILE_ID_KEY, id)
  return id
}

export async function loadSettingsFromDrive(token) {
  try {
    const fileId = await getSettingsFileId(token)
    if (!fileId) return { settings: null, error: null }

    const res = await fetch(`${DRIVE}/files/${fileId}?alt=media`, { headers: auth(token) })
    if (res.status === 404) {
      localStorage.removeItem(SETTINGS_FILE_ID_KEY)
      return { settings: null, error: null }
    }
    if (!res.ok) throw Object.assign(new Error(`Drive read failed: ${res.status}`), { status: res.status })

    const settings = await res.json()
    return { settings: settings && typeof settings === 'object' ? settings : null, error: null }
  } catch (e) {
    const status = e.status
    if (status === 401 || status === 403) return { settings: null, error: 'scope' }
    return { settings: null, error: 'network' }
  }
}

// Returns { ok: boolean, status?: number }
export async function saveSettingsToDrive(token, settings) {
  try {
    const body = JSON.stringify(settings)
    let fileId

    try {
      fileId = await getSettingsFileId(token)
    } catch (e) {
      return { ok: false, status: e.status }
    }

    if (fileId) {
      const res = await fetch(`${UPLOAD}/files/${fileId}?uploadType=media`, {
        method: 'PATCH',
        headers: { ...auth(token), 'Content-Type': 'application/json' },
        body,
      })
      if (res.status === 404) {
        localStorage.removeItem(SETTINGS_FILE_ID_KEY)
        return saveSettingsToDrive(token, settings)
      }
      return { ok: res.ok, status: res.status }
    } else {
      const boundary = 'qm_boundary_004'
      const metadata = JSON.stringify({ name: SETTINGS_FILE_NAME, parents: ['appDataFolder'] })
      const multipart = [
        `--${boundary}`,
        'Content-Type: application/json; charset=UTF-8',
        '',
        metadata,
        `--${boundary}`,
        'Content-Type: application/json',
        '',
        body,
        `--${boundary}--`,
      ].join('\r\n')

      const res = await fetch(`${UPLOAD}/files?uploadType=multipart`, {
        method: 'POST',
        headers: { ...auth(token), 'Content-Type': `multipart/related; boundary=${boundary}` },
        body: multipart,
      })
      if (res.ok) {
        const data = await res.json()
        if (data.id) localStorage.setItem(SETTINGS_FILE_ID_KEY, data.id)
      }
      return { ok: res.ok, status: res.status }
    }
  } catch {
    return { ok: false }
  }
}

// Returns { ok: boolean, status?: number }
export async function saveToDrive(token, habits) {
  try {
    const body = JSON.stringify(habits)
    let fileId

    try {
      fileId = await getFileId(token)
    } catch (e) {
      return { ok: false, status: e.status }
    }

    if (fileId) {
      const res = await fetch(`${UPLOAD}/files/${fileId}?uploadType=media`, {
        method: 'PATCH',
        headers: { ...auth(token), 'Content-Type': 'application/json' },
        body,
      })
      if (res.status === 404) {
        setCachedId(null)
        return saveToDrive(token, habits)
      }
      return { ok: res.ok, status: res.status }
    } else {
      const boundary = 'qm_boundary_001'
      const metadata = JSON.stringify({ name: FILE_NAME, parents: ['appDataFolder'] })
      const multipart = [
        `--${boundary}`,
        'Content-Type: application/json; charset=UTF-8',
        '',
        metadata,
        `--${boundary}`,
        'Content-Type: application/json',
        '',
        body,
        `--${boundary}--`,
      ].join('\r\n')

      const res = await fetch(`${UPLOAD}/files?uploadType=multipart`, {
        method: 'POST',
        headers: {
          ...auth(token),
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipart,
      })

      if (res.ok) {
        const data = await res.json()
        setCachedId(data.id || null)
      }
      return { ok: res.ok, status: res.status }
    }
  } catch {
    return { ok: false }
  }
}
