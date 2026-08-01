import { useEffect, useState } from "react"
import { get } from "./api.js"
import { onSessionChanged } from "./sessionEvents.js"

/**
 * Personalisierte Vorschläge (P7).
 *
 * BEWUSST NICHT im geteilten Store-Cache (`store.jsx`): der hält den Katalog, der für alle gleich
 * ist. Vorschläge hängen am Konto — sie müssen beim Kontowechsel weg sein und dürfen nicht in
 * einem Cache landen, dessen Lebensdauer sich am Katalog orientiert.
 *
 * Ohne Anmeldung, bei abgeschaltetem Feature oder nach einem Widerspruch antwortet der lokale
 * Server `{ main: null, rows: [] }` — kein Fehler. Die aufrufende Seite zeigt dann weiter ihre
 * generischen Kategorien; genau dafür behält sie ihren Rückfall.
 *
 * @param {"hero"|"row"} surface
 * @param {number} limit
 * @returns {{ main: object|null, rows: object[] }}
 */
export function useRecommendations(surface = "row", limit = 12) {
	const [state, setState] = useState({ main: null, rows: [] })

	useEffect(() => {
		let aktiv = true

		async function laden() {
			try {
				const d = await get(`/api/recommendations?surface=${encodeURIComponent(surface)}&limit=${limit}`)
				if (!aktiv || !d) return
				// `personalized: false` heißt: der Server hat die generische Kategorie geliefert. Dann
				// bleibt die Seite bei ihrer eigenen — sie ist dieselbe, nur ohne Umweg.
				setState({
					main: d.main && d.main.personalized ? d.main : null,
					rows: Array.isArray(d.rows) ? d.rows.filter(r => r && r.personalized && r.games && r.games.length > 0) : [],
				})
			} catch {
				// Ein fehlender Vorschlag ist kein Ausfall.
			}
		}

		laden()
		// Beim Kontowechsel neu laden — sonst sähe der nächste Nutzer die Reihen des vorigen.
		const ab = onSessionChanged(() => {
			setState({ main: null, rows: [] })
			laden()
		})
		return () => {
			aktiv = false
			if (typeof ab === "function") ab()
		}
	}, [surface, limit])

	return state
}
