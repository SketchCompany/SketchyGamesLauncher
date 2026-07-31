import { useEffect } from "react"
import { Outlet, useNavigate } from "react-router-dom"
import { get } from "./api.js"
import { useNotify } from "./notifications.jsx"
import { useOffline } from "./offline.jsx"

/**
 * Layout-Guard für alle Seiten mit Login-Pflicht. Leitet zur Login-Seite um, wenn
 *  1) die Session beim Betreten lokal ungültig/abgelaufen ist (/api/session/status), oder
 *  2) zur Laufzeit ein Remote-401 auftritt (Event `sgl:session-expired`, gefeuert vom
 *     Fetch-Wrapper in lib/api.js, sobald die lokale API `sessionExpired: true` meldet).
 * Login-freie Seiten (/login, /signup, /verify, /loading) liegen NICHT unter diesem Guard.
 * Im Offlinemodus ist der Guard komplett inaktiv — der Nutzer spielt bewusst ohne Anmeldung.
 */
export default function SessionGuard() {
	const navigate = useNavigate()
	const notify = useNotify()
	const { offline } = useOffline()

	useEffect(() => {
		if (offline) return // Offlinemodus: keine Session-Prüfung, kein Redirect auf /login.
		let alive = true
		let handled = false
		const redirect = () => {
			if (handled) return
			handled = true
			notify("Sitzung abgelaufen", "Bitte melde dich erneut an.", "warning")
			navigate("/login", { replace: true })
		}

		get("/api/session/status")
			.then(s => { if (alive && s && s.valid === false) redirect() })
			.catch(() => { /* offline/Fehler: nicht hart ausloggen */ })

		window.addEventListener("sgl:session-expired", redirect)
		return () => { alive = false; window.removeEventListener("sgl:session-expired", redirect) }
	}, [navigate, notify, offline])

	return <Outlet />
}
