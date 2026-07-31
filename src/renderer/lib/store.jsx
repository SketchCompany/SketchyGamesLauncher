import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import { get } from "./api.js"
import { useNotify } from "./notifications.jsx"
import { useOffline } from "./offline.jsx"
import { onSessionChanged } from "./sessionEvents.js"

/**
 * Geteilter Store-Cache für den ganzen Renderer. `/api/store` wird nur EINMAL pro Sitzung
 * geladen und von Store/Suche/Home/Produkt gemeinsam genutzt (statt 4× separat) — das spart
 * API-Aufrufe. Ein Refresh-Knopf erzwingt ein Neuladen (server: ?force=1). Damit der Knopf
 * bei Klick-Spam die API nicht überrennt, gibt es nur eine KURZE Debounce-Sperre
 * (REFRESH_DEBOUNCE); ein manueller Refresh lädt sonst sofort frische Inhalte. (Die frühere
 * 5-Min-/30-Min-Sperre entfiel — sie konnte in localStorage „hängen" bleiben und den Store
 * ganz am Laden hindern.)
 */
const StoreContext = createContext(null)

const REFRESH_DEBOUNCE = 15 * 1000 // kurzer Doppelklick-/Spam-Schutz

// Alten (evtl. „hängenden") Limiter-Zustand einer früheren Version einmalig verwerfen.
try { localStorage.removeItem("sgl.store.limiter") } catch { /* localStorage evtl. blockiert */ }

export function StoreProvider({ children }) {
	const notify = useNotify()
	const { offline } = useOffline()
	const [data, setData] = useState(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState(null) // AppError | null (Ursache für die UI)

	const lastRefreshAt = useRef(0)
	const [cooldownUntil, setCooldownUntil] = useState(0) // nur für den Button-Countdown
	const hydrated = useRef(false)
	const inFlight = useRef(false)

	const fetchStore = useCallback(async force => {
		if (inFlight.current) return
		inFlight.current = true
		setLoading(true)
		try {
			const d = await get(force ? "/api/store?force=1" : "/api/store")
			setData(d)
			setError(null)
		} catch (e) {
			setError(e)
		} finally {
			setLoading(false)
			inFlight.current = false
		}
	}, [])

	// Erst-Hydration (einmalig). Im Offlinemodus NICHT laden — der Store ist offline nicht nutzbar
	// (kein sinnloser Call, keine Fehler-UI); loading auf false setzen, damit nichts hängt.
	useEffect(() => {
		if (hydrated.current) return
		hydrated.current = true
		if (offline) { setLoading(false); return }
		fetchStore(false)
	}, [fetchStore, offline])

	// Kontowechsel: der Katalog trägt nutzerabhängige Felder (`owned`), der Cache des Vorgängers
	// wäre also falsch. force=1, damit auch der 60s-Cache im Hauptprozess übergangen wird.
	useEffect(() => onSessionChanged(() => {
		hydrated.current = true
		setData(null)
		fetchStore(true)
	}), [fetchStore])

	const refresh = useCallback(() => {
		const now = Date.now()
		const sinceLast = now - lastRefreshAt.current
		if (sinceLast < REFRESH_DEBOUNCE) {
			const secs = Math.ceil((REFRESH_DEBOUNCE - sinceLast) / 1000)
			notify("Kurz warten", `Du kannst den Store in ${secs}s erneut aktualisieren.`, "info")
			return
		}
		lastRefreshAt.current = now
		setCooldownUntil(now + REFRESH_DEBOUNCE)
		fetchStore(true)
	}, [notify, fetchStore])

	const value = {
		data,
		loading,
		error,
		refresh,
		cooldownUntil,
		cooldownMs: REFRESH_DEBOUNCE,
	}

	return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
	const ctx = useContext(StoreContext)
	if (!ctx) throw new Error("useStore braucht einen StoreProvider")
	return ctx
}
