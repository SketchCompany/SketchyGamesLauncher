import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { get, sendChecked, AppError } from "../../lib/api.js"
import { useNotify } from "../../lib/notifications.jsx"
import { useDialog } from "../../lib/dialog.jsx"
import { notifyError } from "../../lib/loadError.js"
import { notifySessionChanged } from "../../lib/sessionEvents.js"
import { minSettle } from "../../lib/minDelay.js"
import { PanelSkeleton } from "../Skeletons.jsx"
import ErrorState from "../ErrorState.jsx"

const inputCls =
	"w-full rounded border border-border-strong bg-bg-2 px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-neon-green focus:outline-none"

/** Konto-Abschnitt der Einstellungen (Profil, E-Mail, Passwort, Abmelden). Aus Account.jsx portiert. */
export default function KontoSection() {
	const [account, setAccount] = useState(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState(null)
	const [user, setUser] = useState("")
	const [email, setEmail] = useState("")
	const [saving, setSaving] = useState(false)
	const notify = useNotify()
	const { confirm } = useDialog()
	const navigate = useNavigate()

	// Bei Retry bleibt das Panel-Skeleton mind. 1s sichtbar (minSettle), damit es nicht aufblitzt.
	const load = useCallback((retry = false) => {
		setError(null)
		setLoading(true)
		const settle = minSettle(retry)
		get("/api/account", true)
			.then(res => {
				const d = res?.data || res
				// Offline liefert der Server nur ein Minimalobjekt ({id}, keine Profildaten) mit
				// status:1 — das Konto lässt sich dann nicht anzeigen/ändern → als Fehler behandeln.
				if (!d || (!d.username && !d.user && !d.email)) {
					return settle(() => { setError(new AppError({ kind: "local", message: "Kontodaten benötigen eine Verbindung." })); setLoading(false) })
				}
				return settle(() => {
					setAccount(d)
					setUser(d.user || d.username || "")
					setEmail(d.email || "")
					setLoading(false)
				})
			})
			.catch(e => settle(() => { setError(e); setLoading(false) }))
	}, [])
	useEffect(load, [load])

	async function save() {
		setSaving(true)
		try {
			await sendChecked("/api/account/update", { user, email })
			notify("Gespeichert", "Deine Kontodaten wurden aktualisiert.", "success")
		} catch (err) {
			notifyError(notify, err, { context: "Kontodaten konnten nicht gespeichert werden" })
		} finally {
			setSaving(false)
		}
	}

	async function logout() {
		if (!(await confirm("Abmelden?", "Möchtest du dich wirklich abmelden?"))) return
		try { await get("/api/account/logout") } catch { /* noop */ }
		notifySessionChanged() // nutzerabhängige Daten (Store-owned, Wunschliste) verwerfen
		navigate("/login")
	}

	return (
		<section className="settings-section">
			<header className="settings-section__head">
				<h3 className="settings-section__title">Konto</h3>
				<p className="settings-section__sub">
					{account?.username || account?.user ? `Angemeldet als ${account.username || account.user}` : error ? "Konto konnte nicht geladen werden" : loading ? "Wird geladen…" : "Nicht angemeldet"}
				</p>
			</header>

			{error ? (
				<ErrorState error={error} onRetry={() => load(true)} variant="inline" />
			) : loading ? (
				<PanelSkeleton rows={3} />
			) : (
				<div className="hud-frame flex flex-col gap-4 p-5">
					<label className="block">
						<span className="mb-1.5 block text-sm font-bold text-text-secondary">Benutzername</span>
						<input className={inputCls} value={user} onChange={e => setUser(e.target.value)} autoComplete="username" />
					</label>
					<label className="block">
						<span className="mb-1.5 block text-sm font-bold text-text-secondary">E-Mail</span>
						<input className={inputCls} type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
					</label>
					<p className="m-0 text-sm text-text-muted">
						<i className="bi bi-shield-lock" aria-hidden="true" /> Passwort &amp; Zwei-Faktor-Authentifizierung findest du unter <strong>Sicherheit</strong>.
					</p>
					<div className="flex gap-2.5">
						<button className="cta cta-primary" onClick={save} disabled={saving}>{saving ? "Speichern…" : "Speichern"}</button>
						<button className="cta cta-danger" onClick={logout}>
							<i className="bi bi-box-arrow-right" aria-hidden="true" /> Abmelden
						</button>
					</div>
				</div>
			)}
		</section>
	)
}
