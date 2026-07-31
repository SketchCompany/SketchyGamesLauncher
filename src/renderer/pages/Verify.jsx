import { useState, useRef, useEffect } from "react"
import { Link, useNavigate, useLocation } from "react-router-dom"
import { send } from "../lib/api.js"
import { useNotify } from "../lib/notifications.jsx"
import { notifySessionChanged } from "../lib/sessionEvents.js"
import AuthShell, { CodeInputs, authLinkCls } from "../components/AuthShell.jsx"

export default function Verify() {
	const [code, setCode] = useState(["", "", "", "", "", ""])
	const [loading, setLoading] = useState(false)
	const refs = useRef([])
	const navigate = useNavigate()
	const notify = useNotify()
	const { state } = useLocation()
	const account = state || {}

	useEffect(() => {
		// Bestätigungs-E-Mail anfordern (v1: E-Mail muss VOR der Kontoerstellung verifiziert sein).
		if (account.email) send("/api/account/verify", { user: account.user, email: account.email }).catch(() => {})
	}, []) // eslint-disable-line

	function setDigit(i, v) {
		if (!/^\d?$/.test(v)) return
		setCode(c => { const n = [...c]; n[i] = v; return n })
		if (v && i < 5) refs.current[i + 1]?.focus()
	}

	async function submit(e) {
		e?.preventDefault()
		const joined = code.join("")
		if (joined.length < 6) { notify("Fehler", "Bitte gib den 6-stelligen Code ein.", "error"); return }
		setLoading(true)
		try {
			const res = await send("/api/account/signup", { ...account, code: joined })
			if (res && (res.correct ?? true)) {
				// /account/signup speichert bereits die Session → direkt in die App (replace, damit
				// die Auth-Seiten nicht im Verlauf bleiben und die Pfeile nicht dorthin zurückführen).
				notify("Willkommen!", "Dein Account wurde erstellt.", "success")
				notifySessionChanged() // frisches Konto → nutzerabhängige Daten neu laden
				navigate("/", { replace: true })
			} else {
				notify("Fehler", "Der Code ist ungültig oder abgelaufen.", "error")
			}
		} catch (err) {
			notify("Fehler", "Verifizierung fehlgeschlagen: " + err, "error")
		} finally {
			setLoading(false)
		}
	}

	return (
		<AuthShell
			title="E-Mail bestätigen"
			lead={`Gib den 6-stelligen Code ein, den wir an ${account.email || "deine E-Mail"} gesendet haben.`}
			footer={<>Kein Code erhalten? <Link to="/signup" replace className={authLinkCls}>Zurück zur Registrierung</Link></>}
		>
			<form className="flex flex-col gap-4" onSubmit={submit}>
				<CodeInputs code={code} refs={refs} setDigit={setDigit} />
				<button type="submit" className="cta cta-primary w-full" disabled={loading}>
					{loading ? "Prüfen…" : "Bestätigen"}
				</button>
			</form>
		</AuthShell>
	)
}
