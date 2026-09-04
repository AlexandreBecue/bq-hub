import exercisesData from '../assets/exercises.json'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const FILE_NAME = 'bq-metrics-sync.json'

export interface SyncedData {
  workouts: Record<number, any>
  lastSync: number
}

// Generates the Google OAuth authorization URL
export function getAuthUrl(): string {
  if (!CLIENT_ID) {
    throw new Error("Le Client ID Google (VITE_GOOGLE_CLIENT_ID) est introuvable. Veuillez vérifier votre fichier .env.");
  }
  const redirectUri = encodeURIComponent(window.location.origin)
  const scope = encodeURIComponent('https://www.googleapis.com/auth/drive.file')
  const clientId = encodeURIComponent(CLIENT_ID)
  return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=token&scope=${scope}&prompt=select_account`
}

// Checks if the current page was loaded from a Google OAuth redirect
export function checkAuthCallback(): string | null {
  const hash = window.location.hash
  if (hash && hash.includes('access_token')) {
    const params = new URLSearchParams(hash.substring(1))
    const token = params.get('access_token')
    const expiresIn = params.get('expires_in')
    if (token) {
      localStorage.setItem('gdrive_access_token', token)
      const expiresAt = Date.now() + Number(expiresIn || 3600) * 1000
      localStorage.setItem('gdrive_token_expires_at', String(expiresAt))
      // Clean up the URL hash
      window.history.replaceState(null, '', window.location.pathname)
      return token
    }
  }
  return null
}

// Retrieves the active access token, ensuring it hasn't expired
export function getAccessToken(): string | null {
  const token = localStorage.getItem('gdrive_access_token')
  const expiresAt = localStorage.getItem('gdrive_token_expires_at')
  if (!token || !expiresAt) return null

  if (Date.now() > Number(expiresAt)) {
    // Token expired, clear storage
    logout()
    return null
  }
  return token
}

export function isAuthenticated(): boolean {
  return getAccessToken() !== null
}

export function logout() {
  localStorage.removeItem('gdrive_access_token')
  localStorage.removeItem('gdrive_token_expires_at')
}

// Helper to make Google Drive REST API calls
async function driveFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getAccessToken()
  if (!token) throw new Error('Utilisateur non connecté à Google Drive.')

  const headers = new Headers(options.headers || {})
  headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(url, { ...options, headers })
  if (res.status === 401) {
    logout()
    throw new Error('Session expirée, veuillez vous reconnecter.')
  }
  return res
}

// Searches for sync file in Google Drive and returns its file ID
export async function findSyncFileId(): Promise<string | null> {
  const query = encodeURIComponent(`name = '${FILE_NAME}' and trashed = false`)
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`
  
  const res = await driveFetch(url)
  if (!res.ok) throw new Error('Erreur lors de la recherche du fichier de synchronisation.')
  
  const data = await res.json()
  if (data.files && data.files.length > 0) {
    return data.files[0].id
  }
  return null
}

// Downloads the raw sync.json content from Google Drive
export async function downloadSyncFile(fileId: string): Promise<any> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`
  const res = await driveFetch(url)
  if (!res.ok) throw new Error(`Impossible de télécharger le fichier ${FILE_NAME}.`)
  return res.json()
}

// Uploads updated sync file to Google Drive
export async function uploadSyncFile(fileId: string, data: any): Promise<void> {
  const url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`
  const res = await driveFetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  })
  if (!res.ok) throw new Error('Impossible de sauvegarder la mise à jour sur Google Drive.')
}

// Parse workouts from sync file
export function extractWorkoutsFromSyncData(syncData: any): Record<number, any> | null {
  if (!syncData || !syncData.collections || !syncData.records) return null

  // 1. Find the collection for workouts (look for names containing "bq-coach")
  const workoutCol = syncData.collections.find((c: any) => 
    c.name.toLowerCase().includes('bq-coach')
  )
  if (!workoutCol) return null

  const workouts: Record<number, any> = { 6: {}, 0: {} } // Start with default rest days
  
  // 2. Extract and parse workouts records
  const records = syncData.records.filter((r: any) => r.collectionId === workoutCol.id)
  
  for (const rec of records) {
    const data = rec.data
    if (!data) continue

    // Detect the day index (e.g., fields 'jour', 'day', or matching 0-7)
    let day: number | null = null
    for (const key of Object.keys(data)) {
      if (key.toLowerCase().includes('jour') || key.toLowerCase().includes('day')) {
        const val = Number(data[key])
        if (!isNaN(val) && val >= 0 && val <= 7) {
          day = val
          break
        }
      }
    }

    // Fallback if day is not explicitly named but key is just a number
    if (day === null) {
      const numKeys = Object.keys(data).map(Number).filter(n => !isNaN(n) && n >= 0 && n <= 7)
      if (numKeys.length > 0) day = numKeys[0]
    }

    if (day === null) continue

    // Find the workout content (stringified JSON inside some field or data itself)
    let workoutContent: any = null
    for (const key of Object.keys(data)) {
      const val = data[key]
      if (typeof val === 'string' && val.trim().startsWith('{')) {
        try {
          workoutContent = JSON.parse(val)
          break
        } catch {}
      }
    }

    // If no stringified JSON was found, maybe the data itself has the workout structure
    if (!workoutContent && data.title) {
      workoutContent = { ...data }
    }

    if (workoutContent) {
      // Map 7 back to 0 (Sunday) if necessary
      const dayKey = day === 7 ? 0 : day
      workouts[dayKey] = workoutContent
    }
  }

  // 3. Extract today's completed workouts and store them
  const targetCol = syncData.collections.find((c: any) => 
    c.name.toLowerCase().includes('renforcement musculaire')
  )
  if (targetCol) {
    const todayYMD = new Date().toISOString().split('T')[0]
    const completedRecords = syncData.records.filter((r: any) => 
      r.collectionId === targetCol.id && r.data && r.data.date === todayYMD
    )
    const completedTitles = completedRecords.map((r: any) => r.data.nom || r.data.seance).filter(Boolean)
    if (completedTitles.length > 0) {
      const todayStr = new Date().toDateString()
      localStorage.setItem('bq_coach_completed_workouts', JSON.stringify({ date: todayStr, titles: completedTitles }))
    }
  }

  return Object.keys(workouts).length > 2 ? workouts : null
}

// Appends a completed workout record to sync file and uploads it
export async function pushCompletedWorkout(
  workoutTitle: string, 
  durationSeconds: number, 
  isRunning: boolean,
  distanceKm?: number,
  sessionDetails?: any
): Promise<void> {
  const fileId = await findSyncFileId()
  if (!fileId) throw new Error(`Fichier ${FILE_NAME} introuvable sur votre Drive.`)

  const syncData = await downloadSyncFile(fileId)
  if (!syncData || !syncData.collections || !syncData.records) {
    throw new Error('Fichier de synchronisation invalide ou corrompu.')
  }

  const todayStr = new Date().toISOString().split('T')[0]
  
  function formatHHMMSS(sec: number) {
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    const s = sec % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  // 1. If it's a running (cardio) session, keep original behavior
  if (isRunning) {
    const cardioCol = syncData.collections.find((c: any) =>
      c.name.toLowerCase().includes('cardio')
    )
    if (!cardioCol) {
      throw new Error('Aucune collection cardio cible trouvée dans bq-metrics.')
    }

    const recordData: Record<string, any> = {}
    for (const field of cardioCol.fields) {
      const key = field.key
      if (key === 'date') {
        recordData[key] = todayStr
      } else if (key === 'sport') {
        let sport = ''
        const exerciseId = sessionDetails?.cardio?.exerciseId
        if (exerciseId === 'running') {
          sport = 'Course à pied'
        } else if (exerciseId === 'cycling') {
          sport = 'Cyclisme'
        } else {
          throw new Error('Le sport pratiqué durant cette séance n\'est pas reconnu par l\'application bq-metrics')
        }
        recordData[key] = sport
      } else if (key === 'distance') {
        recordData[key] = distanceKm || 0
      } else if (key === 'temps') {
        recordData[key] = formatHHMMSS(durationSeconds)
      } else if (key === 'commentaire') {
        recordData[key] = workoutTitle
      } else if (key === 'nom' || key === 'seance') {
        recordData[key] = workoutTitle
      } else if (field.type === 'boolean') {
        recordData[key] = false
      }
    }

    const randomSuffix = Math.random().toString(36).substring(2, 11)
    const newRecord = {
      id: `rec-${randomSuffix}`,
      collectionId: cardioCol.id,
      data: recordData,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    syncData.records.push(newRecord)
    await uploadSyncFile(fileId, syncData)
    return
  }

  // 2. Musculation / Strength session (Approach 2: Hybrid)
  // Identify both target collections
  const sessionCol = syncData.collections.find((c: any) =>
    c.name.toLowerCase().includes('renforcement musculaire') &&
    c.name.toLowerCase().includes('séance')
  )
  const detailCol = syncData.collections.find((c: any) =>
    c.name.toLowerCase().includes('renforcement musculaire') &&
    c.name.toLowerCase().includes('exercice')
  )

  if (!sessionCol && !detailCol) {
    throw new Error('Aucune collection cible "Sport - Séances" ou "Sport - Détail exercices" trouvée dans bq-metrics.')
  }

  // Extract exercises to log for telemetry
  const exercisesToLog: Array<{
    name: string
    phase: 'Échauffement' | 'Circuit' | 'Finisseur'
    sets: number
    workDuration: number
    restDuration: number
  }> = []

  if (sessionDetails) {
    try {
      const exerciseMap: Record<string, any> = Object.fromEntries(
        exercisesData.map((e: any) => [e.id, e])
      )

      const strength = sessionDetails.strength || sessionDetails

      if (strength.warmup?.exerciseId) {
        const name = exerciseMap[strength.warmup.exerciseId]?.name || strength.warmup.exerciseId
        exercisesToLog.push({
          name,
          phase: 'Échauffement',
          sets: 1,
          workDuration: strength.warmup.workDuration,
          restDuration: strength.warmup.restDuration
        })
      }

      strength.exercises?.forEach((ex: any) => {
        const name = exerciseMap[ex.exerciseId]?.name || ex.exerciseId
        exercisesToLog.push({
          name,
          phase: 'Circuit',
          sets: strength.sets || 1,
          workDuration: ex.workDuration,
          restDuration: ex.restDuration
        })
      })

      strength.finisher?.forEach((ex: any) => {
        const name = exerciseMap[ex.exerciseId]?.name || ex.exerciseId
        exercisesToLog.push({
          name,
          phase: 'Finisseur',
          sets: ex.sets || 1,
          workDuration: ex.workDuration,
          restDuration: ex.restDuration
        })
      })
    } catch (err) {
      console.error("Erreur lors de la préparation de la télémétrie :", err)
    }
  }

  // Write Session-level Overview log
  if (sessionCol) {
    const recordData: Record<string, any> = {}
    for (const field of sessionCol.fields) {
      const key = field.key
      if (key === 'date') {
        recordData[key] = todayStr
      } else if (key === 'seance' || key === 'nom' || key === 'titre') {
        recordData[key] = workoutTitle
      } else if (key === 'temps' || key === 'duree') {
        recordData[key] = formatHHMMSS(durationSeconds)
      } else if (key === 'programme' || key === 'details_json' || key === 'details') {
        recordData[key] = sessionDetails ? JSON.stringify(sessionDetails) : ''
      } else if (field.type === 'boolean') {
        recordData[key] = false
      }
    }

    const randomSuffix = Math.random().toString(36).substring(2, 11)
    const newRecord = {
      id: `rec-${randomSuffix}`,
      collectionId: sessionCol.id,
      data: recordData,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    syncData.records.push(newRecord)
  }

  // Write granular Exercise-level Telemetry logs
  if (detailCol && exercisesToLog.length > 0) {
    for (const item of exercisesToLog) {
      const recordData: Record<string, any> = {}
      for (const field of detailCol.fields) {
        const key = field.key
        if (key === 'date') {
          recordData[key] = todayStr
        } else if (key === 'exercice' || key === 'nom_exercice' || key === 'nom') {
          recordData[key] = item.name
        } else if (key === 'phase' || key === 'categorie') {
          recordData[key] = item.phase
        } else if (key === 'series' || key === 'sets' || key === 'tours') {
          recordData[key] = item.sets
        } else if (key === 'travail' || key === 'temps_travail' || key === 'work') {
          recordData[key] = item.workDuration
        } else if (key === 'repos' || key === 'temps_repos' || key === 'rest') {
          recordData[key] = item.restDuration
        } else if (field.type === 'boolean') {
          recordData[key] = false
        }
      }

      const randomSuffix = Math.random().toString(36).substring(2, 11)
      const newRecord = {
        id: `rec-${randomSuffix}`,
        collectionId: detailCol.id,
        data: recordData,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
      syncData.records.push(newRecord)
    }
  }

  // Upload updated sync data back to Google Drive
  await uploadSyncFile(fileId, syncData)
}

const WORKOUTS_FILE_NAME = 'bq-coach-workouts.json'

// Searches for custom workouts planning file in Google Drive
export async function findWorkoutsFileId(): Promise<string | null> {
  const query = encodeURIComponent(`name = '${WORKOUTS_FILE_NAME}' and trashed = false`)
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`

  const res = await driveFetch(url)
  if (!res.ok) throw new Error('Erreur lors de la recherche du fichier de planning.')

  const data = await res.json()
  if (data.files && data.files.length > 0) {
    return data.files[0].id
  }
  return null
}

// Downloads the raw workouts planning content from Google Drive
export async function downloadWorkoutsFile(fileId: string): Promise<any> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`
  const res = await driveFetch(url)
  if (!res.ok) throw new Error('Impossible de télécharger le planning depuis Google Drive.')
  return res.json()
}

// Uploads updated workouts planning file to Google Drive
export async function uploadWorkoutsFile(fileId: string, data: any): Promise<void> {
  const url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`
  const res = await driveFetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  })
  if (!res.ok) throw new Error('Impossible de sauvegarder le planning sur Google Drive.')
}

// Creates a new workouts planning file in Google Drive
export async function createWorkoutsFile(data: any): Promise<string> {
  const metadataRes = await driveFetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: WORKOUTS_FILE_NAME,
      mimeType: 'application/json'
    })
  })
  if (!metadataRes.ok) throw new Error('Impossible de créer le fichier de planning sur Google Drive.')
  const fileMeta = await metadataRes.json()
  const fileId = fileMeta.id

  await uploadWorkoutsFile(fileId, data)
  return fileId
}

// Saves workouts planning to Google Drive (updating or creating as needed)
export async function saveWorkoutsToDrive(workouts: Record<number, any>): Promise<void> {
  let fileId = await findWorkoutsFileId()
  if (fileId) {
    await uploadWorkoutsFile(fileId, workouts)
  } else {
    await createWorkoutsFile(workouts)
  }
}

// Synchronizes workouts planning with Google Drive, migrating from legacy bq-metrics if needed
export async function syncWorkoutsFlow(): Promise<Record<number, any> | null> {
  // 1. Search for bq-coach-workouts.json
  let fileId = await findWorkoutsFileId()
  if (fileId) {
    return await downloadWorkoutsFile(fileId)
  }

  // 2. Fallback: Search for legacy bq-metrics-sync.json
  try {
    const legacyFileId = await findSyncFileId()
    if (legacyFileId) {
      const syncData = await downloadSyncFile(legacyFileId)
      const legacyWorkouts = extractWorkoutsFromSyncData(syncData)
      if (legacyWorkouts) {
        // Migrate legacy workouts to the new dedicated file
        await createWorkoutsFile(legacyWorkouts)
        return legacyWorkouts
      }
    }
  } catch (err) {
    console.warn('Erreur lors de la tentative de migration du planning historique :', err)
  }

  return null
}

// Local cache storage helpers
export function getSavedWorkouts(): Record<number, any> | null {
  const cached = localStorage.getItem('bq_coach_synced_data')
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as SyncedData
      return parsed.workouts
    } catch {}
  }
  return null
}

export function saveWorkoutsToLocalCache(workouts: Record<number, any>): void {
  const syncPayload: SyncedData = {
    workouts,
    lastSync: Date.now()
  }
  localStorage.setItem('bq_coach_synced_data', JSON.stringify(syncPayload))
}

export function getSyncTimestamp(): number | null {
  const cached = localStorage.getItem('bq_coach_synced_data')
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as SyncedData
      return parsed.lastSync
    } catch {}
  }
  return null
}

export function markWorkoutAsCompletedToday(title: string): void {
  const todayStr = new Date().toDateString()
  let list: string[] = []
  const saved = localStorage.getItem('bq_coach_completed_workouts')
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      if (parsed.date === todayStr) {
        list = parsed.titles || []
      }
    } catch {}
  }
  if (!list.includes(title)) {
    list.push(title)
  }
  localStorage.setItem('bq_coach_completed_workouts', JSON.stringify({ date: todayStr, titles: list }))
}

export function isWorkoutCompletedToday(title: string): boolean {
  const todayStr = new Date().toDateString()
  const saved = localStorage.getItem('bq_coach_completed_workouts')
  if (!saved) return false
  try {
    const parsed = JSON.parse(saved)
    if (parsed.date === todayStr) {
      return (parsed.titles || []).includes(title)
    }
  } catch {}
  return false
}
