import { useState, useMemo, useCallback } from 'react'

const MAX_ROLLS = 3
const POOL_FRACTION = 0.25

export function useJukeboxEngine(albums = []) {
  const [filters, setFilters] = useState({
    artist: '',
    decade: new Set(),
    genre: new Set(),
    length: new Set(),
    added: new Set(),
  })
  const [mode, setMode] = useState('any')
  const [sessionActive, setSessionActive] = useState(false)
  const [rollsLeft, setRollsLeft] = useState(MAX_ROLLS)
  const [currentPick, setCurrentPick] = useState(null)
  const [previousPick, setPreviousPick] = useState(null)
  const [busy, setBusy] = useState(false)

  const toggleFilter = useCallback((groupKey, value) => {
    setFilters((prev) => {
      const next = { ...prev }
      if (groupKey === 'artist') {
        next.artist = value
      } else {
        const set = new Set(prev[groupKey])
        if (set.has(value)) {
          set.delete(value)
        } else {
          set.add(value)
        }
        next[groupKey] = set
      }
      return next
    })
  }, [])

  const clearFilters = useCallback(() => {
    setFilters({
      artist: '',
      decade: new Set(),
      genre: new Set(),
      length: new Set(),
      added: new Set(),
    })
  }, [])

  const filteredAlbums = useMemo(() => {
    return (albums || []).filter((album) => {
      if (filters.artist.trim()) {
        const q = filters.artist.trim().toLowerCase()
        if (!album.artist_name.toLowerCase().includes(q)) return false
      }
      if (filters.decade.size > 0) {
        if (!album.release_year) return false
        const decadeStr = String(Math.floor(album.release_year / 10) * 10)
        if (!filters.decade.has(decadeStr)) return false
      }
      if (filters.genre.size > 0) {
        const albumGenres = album.genres || []
        const match = albumGenres.some((g) => filters.genre.has(g))
        if (!match) return false
      }
      if (filters.length.size > 0) {
        const minutes = album.duration_ms ? album.duration_ms / 60000 : 0
        const matchesAnyLength = Array.from(filters.length).some((lenKey) => {
          if (lenKey === 'short') return minutes < 35
          if (lenKey === 'mid') return minutes >= 35 && minutes <= 50
          if (lenKey === 'long') return minutes > 50
          return true
        })
        if (!matchesAnyLength) return false
      }
      return true
    })
  }, [albums, filters])

  const pool = useMemo(() => {
    if (!filteredAlbums.length) return []
    let sorted = [...filteredAlbums]
    if (mode === 'least') {
      sorted.sort((a, b) => (a.play_count || 0) - (b.play_count || 0))
    } else if (mode === 'most') {
      sorted.sort((a, b) => (b.play_count || 0) - (a.play_count || 0))
    } else if (mode === 'recent') {
      sorted.sort((a, b) => new Date(b.added_at) - new Date(a.added_at))
    } else {
      return sorted
    }
    const poolSize = Math.max(1, Math.ceil(sorted.length * POOL_FRACTION))
    return sorted.slice(0, poolSize)
  }, [filteredAlbums, mode])

  const executeRoll = useCallback(() => {
    if (!pool.length) return
    const candidates = pool.length > 1 && currentPick ? pool.filter((a) => a.id !== currentPick.id) : pool
    const pick = candidates[Math.floor(Math.random() * candidates.length)]
    setPreviousPick(pick.last_picked_at)
    setCurrentPick(pick)
  }, [pool, currentPick])

  const luckyDip = useCallback(() => {
    if (busy || !pool.length) return
    if (sessionActive) {
      if (rollsLeft === 0) return
      setRollsLeft((prev) => prev - 1)
    } else {
      setSessionActive(true)
      setRollsLeft(MAX_ROLLS)
    }
    executeRoll()
  }, [busy, pool.length, sessionActive, rollsLeft, executeRoll])

  const reroll = useCallback(() => {
    if (busy || !sessionActive || rollsLeft === 0 || !pool.length) return
    setRollsLeft((prev) => prev - 1)
    executeRoll()
  }, [busy, sessionActive, rollsLeft, pool.length, executeRoll])

  const commitSession = useCallback(() => {
    setSessionActive(false)
    setRollsLeft(MAX_ROLLS)
  }, [])

  const canRoll = pool.length > 0 && (!sessionActive || rollsLeft > 0)

  return {
    filters,
    mode,
    sessionActive,
    rollsLeft,
    currentPick,
    previousPick,
    busy,
    setBusy,
    setMode,
    toggleFilter,
    clearFilters,
    filteredAlbums,
    pool,
    luckyDip,
    reroll,
    commitSession,
    canRoll,
    setCurrentPick,
  }
}
