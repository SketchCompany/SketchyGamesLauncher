import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import { get, send } from "./api.js"
import { useNotify } from "./notifications.jsx"
import { useOffline } from "./offline.jsx"
import { onSessionChanged } from "./sessionEvents.js"

/**
 * Client-State der Wunschliste (Port des WishlistProvider der Web-App). Im Launcher ist
 * der Nutzer immer eingeloggt — die Liste wird ausschließlich server-seitig gespeichert
 * (BFF /api/wishlist → zentrale API /v1/wishlist, gemeinsame Postgres-Tabelle mit der
 * Web-App). Umschalten ist optimistisch; bei Fehlern wird zurückgerollt.
 */
const WishlistContext = createContext(null)

export function WishlistProvider({ children }) {
	const notify = useNotify()
	const { offline } = useOffline()
	const [ids, setIds] = useState(new Set())
	const [ready, setReady] = useState(false)
	const hydrated = useRef(false)

	useEffect(() => {
		if (hydrated.current) return
		hydrated.current = true
		// Offlinemodus: Wunschliste braucht Login → nicht laden, nur als „ready" markieren.
		if (offline) { setReady(true); return }
		get("/api/wishlist")
			.then(d => { if (Array.isArray(d?.ids)) setIds(new Set(d.ids)) })
			.catch(() => {})
			.finally(() => setReady(true))
	}, [offline])

	// Kontowechsel: die Wunschliste gehört dem Konto — die des Vorgängers sofort verwerfen und
	// (online) die des neuen Kontos holen.
	useEffect(() => onSessionChanged(() => {
		setIds(new Set())
		get("/api/wishlist")
			.then(d => { if (Array.isArray(d?.ids)) setIds(new Set(d.ids)) })
			.catch(() => {})
	}), [])

	const has = useCallback(gameId => ids.has(gameId), [ids])

	const toggle = useCallback(gameId => {
		setIds(prev => {
			const nextSet = new Set(prev)
			const adding = !nextSet.has(gameId)
			if (adding) nextSet.add(gameId)
			else nextSet.delete(gameId)
			send("/api/wishlist", { gameId, remove: !adding }).catch(() => {
				// Server hat abgelehnt → optimistische Änderung zurücknehmen.
				setIds(cur => {
					const rollback = new Set(cur)
					if (adding) rollback.delete(gameId)
					else rollback.add(gameId)
					return rollback
				})
				notify("Wunschliste", "Die Änderung konnte nicht gespeichert werden.", "error")
			})
			return nextSet
		})
	}, [notify])

	return (
		<WishlistContext.Provider value={{ has, toggle, count: ids.size, ready }}>
			{children}
		</WishlistContext.Provider>
	)
}

export function useWishlist() {
	const ctx = useContext(WishlistContext)
	if (!ctx) throw new Error("useWishlist braucht einen WishlistProvider")
	return ctx
}
