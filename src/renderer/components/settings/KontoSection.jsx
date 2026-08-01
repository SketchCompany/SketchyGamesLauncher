import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { get, send, sendChecked, AppError } from "../../lib/api.js"
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
	// Datenschutz (P7): null = noch unbekannt (dann keinen Schalter zeigen, statt einen falschen
	// Zustand zu behaupten).
	const [personalization, setPersonalization] = useState(null)
	const [retentionDays, setRetentionDays] = useState(90)
	const [privacyBusy, setPrivacyBusy] = useState(false)
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

	// Stand des Widerspruchs. Getrennt vom Konto-Load, damit ein Ausfall hier die Kontodaten nicht
	// mit ins Leere zieht — der Schalter bleibt dann einfach aus der Anzeige.
	useEffect(() => {
		let aktiv = true
		get("/api/account/privacy")
			.then(d => {
				if (!aktiv || !d) return
				setPersonalization(d.personalization !== false)
				if (d.eventRetentionDays) setRetentionDays(d.eventRetentionDays)
			})
			.catch(() => {})
		return () => { aktiv = false }
	}, [])

	// Optimistisch schalten und bei einem Fehler zurückdrehen: ein Schalter, der eine Sekunde lang
	// nichts tut, fühlt sich kaputt an — einer, der zurückspringt und es sagt, ist ehrlich.
	async function togglePersonalization(next) {
		const vorher = personalization
		setPersonalization(next)
		setPrivacyBusy(true)
		try {
			const res = await send("/api/account/privacy", { personalization: next }, true)
			if (!res || res.status !== 1) throw new Error("nicht gespeichert")
			const entfernt = (res.data && res.data.removedEvents) || 0
			if (next) notify("Vorschläge an", "Deine Empfehlungen werden wieder auf dich zugeschnitten.", "success")
			else notify("Vorschläge aus", entfernt > 0 ? `Gespeicherte Aktivität gelöscht (${entfernt} Einträge).` : "Du siehst ab sofort die allgemeinen Empfehlungen.", "success")
		} catch {
			setPersonalization(vorher)
			notify("Fehlgeschlagen", "Die Einstellung konnte nicht gespeichert werden.", "error")
		} finally {
			setPrivacyBusy(false)
		}
	}

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

					{/* Datenschutz (P7). Der Wert liegt am Konto und gilt auch auf der Website. */}
					{personalization !== null && (
						<label className="flex cursor-pointer items-start gap-2.5 border-t border-border-strong pt-4">
							<input type="checkbox" className="mt-0.5 accent-neon-green" checked={personalization} disabled={privacyBusy} onChange={e => togglePersonalization(e.target.checked)} />
							<span>
								<span className="block font-bold text-text-primary">Empfehlungen auf mich zuschneiden</span>
								<span className="mt-0.5 block text-sm text-text-muted">
									{personalization
										? `Wir merken uns, welche Spiele du im Store ansiehst und startest. Gespeichert werden nur Spiel, Art, Dauer und Datum — kein Gerät, keine IP-Adresse. Nach ${retentionDays} Tagen wird das automatisch gelöscht.`
										: "Du siehst die allgemeinen Empfehlungen. Es wird nichts über deine Store-Nutzung gespeichert, und die bisherigen Einträge wurden gelöscht."}
								</span>
							</span>
						</label>
					)}
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
