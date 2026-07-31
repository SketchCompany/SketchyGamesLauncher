import { createContext, useContext, useCallback, useEffect, useState } from "react"
import { get, send } from "./api.js"

/**
 * Offlinemodus-Zustand für den ganzen Renderer. Quelle ist die (lokale) Einstellung `offlineMode`
 * aus /api/settings — funktioniert also auch ohne Netz. Wenn aktiv:
 *  - der SessionGuard leitet NICHT auf /login (Zugang ohne Anmeldung),
 *  - Online-Bereiche (Store/Suche/Konto/Glocke) sind deaktiviert,
 *  - Startup-Fetches (Store/Wishlist/Notifications) werden übersprungen.
 *
 * WICHTIG: /api/settings ersetzt beim Speichern die GANZE Datei (sanitizeSettings) — daher beim
 * Umschalten immer das volle Objekt mit gemergtem offlineMode senden.
 */
const OfflineCtx = createContext(null)

export function OfflineProvider({ children }) {
	const [settings, setSettings] = useState(null) // null = lädt (lokal, schnell)

	useEffect(() => {
		get("/api/settings").then(s => setSettings(s && typeof s === "object" ? s : {})).catch(() => setSettings({}))
	}, [])

	const setOffline = useCallback(async (value) => {
		// Optimistisch spiegeln, dann volle Settings holen + gemergt speichern.
		setSettings(s => ({ ...(s || {}), offlineMode: value }))
		try {
			const current = await get("/api/settings").catch(() => ({}))
			await send("/api/settings", { ...(current && typeof current === "object" ? current : {}), offlineMode: value })
		} catch { /* offline: Setting bleibt lokal gespiegelt */ }
	}, [])

	// Zustand erst nach dem (lokalen) Laden freigeben, damit Gate/Guard/Nav nicht flackern.
	if (settings === null) return null

	return (
		<OfflineCtx.Provider value={{ offline: !!settings.offlineMode, setOffline }}>
			{children}
		</OfflineCtx.Provider>
	)
}

export function useOffline() {
	const ctx = useContext(OfflineCtx)
	// Fallback, falls außerhalb des Providers genutzt (sollte nicht vorkommen): nie offline.
	return ctx || { offline: false, setOffline: async () => {} }
}
