import { useEffect, useState } from "react"
import { getChecked, sendChecked } from "../../lib/api.js"
import { useNotify } from "../../lib/notifications.jsx"
import { notifyError } from "../../lib/loadError.js"
import { persistImportant } from "../../lib/notificationsClient.js"
import { minSettle } from "../../lib/minDelay.js"
import { passwordProblem } from "../../lib/utils.js"
import { SettingGroup } from "./SettingsShell.jsx"
import ErrorState from "../ErrorState.jsx"
import { Skeleton } from "../Skeletons.jsx"

const inputCls =
	"w-full rounded border border-border-strong bg-bg-2 px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-neon-green focus:outline-none"

// getChecked/sendChecked werfen einen typisierten AppError, wenn der Server status !== 1 meldet —
// so lassen sich Verbindungs- von Validierungsfehlern unterscheiden (siehe notifyError).

// ---------------------------------------------------------------------------
// Skeleton-Loader je Panel (gleiche Optik wie im Rest der App)
// ---------------------------------------------------------------------------
function FieldSkeleton() {
	return (
		<div className="flex flex-col gap-1.5">
			<Skeleton className="h-[0.8em] rounded-md" width="40%" />
			<Skeleton className="h-10 w-full rounded" />
		</div>
	)
}
function PasswordSkeleton() {
	return (
		<div className="hud-frame flex flex-col gap-3 p-4" role="status" aria-label="Wird geladen">
			<FieldSkeleton />
			<FieldSkeleton />
			<FieldSkeleton />
			<Skeleton className="h-10 rounded" width="150px" />
		</div>
	)
}
function TwoFactorSkeleton() {
	return (
		<div className="hud-frame flex items-center justify-between gap-3 p-4" role="status" aria-label="Wird geladen">
			<Skeleton className="h-[0.9em] max-w-md flex-1 rounded-md" width="70%" />
			<Skeleton className="h-10 shrink-0 rounded" width="110px" />
		</div>
	)
}
function SessionsSkeleton({ rows = 2 }) {
	return (
		<div className="flex flex-col gap-2" role="status" aria-label="Sitzungen werden geladen">
			{Array.from({ length: rows }).map((_, i) => (
				<div key={i} className="flex items-center justify-between gap-3 rounded border border-border bg-bg-2 px-3 py-2.5">
					<div className="flex min-w-0 flex-1 items-center gap-3">
						<Skeleton className="size-6 shrink-0 rounded" />
						<div className="flex flex-1 flex-col gap-1">
							<Skeleton className="h-[0.8em] rounded-md" width="50%" />
							<Skeleton className="h-[0.7em] rounded-md" width="70%" />
						</div>
					</div>
					<Skeleton className="h-8 shrink-0 rounded" width="80px" />
				</div>
			))}
		</div>
	)
}

/** Passwortfeld mit Auge-Umschalter (Klartext anzeigen/verbergen). */
function PasswordField({ label, value, onChange, autoComplete, placeholder }) {
	const [show, setShow] = useState(false)
	return (
		<label className="block">
			<span className="mb-1.5 block text-sm font-bold text-text-secondary">{label}</span>
			<div className="relative">
				<input className={inputCls + " pr-10"} type={show ? "text" : "password"} value={value} onChange={onChange} autoComplete={autoComplete} placeholder={placeholder} />
				<button type="button" onClick={() => setShow(v => !v)} aria-label={show ? "Passwort verbergen" : "Passwort anzeigen"} className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 cursor-pointer place-items-center rounded text-text-muted hover:text-text-primary focus-visible:outline-2 focus-visible:outline-neon-green">
					<i className={`bi ${show ? "bi-eye-slash" : "bi-eye"}`} aria-hidden="true" />
				</button>
			</div>
		</label>
	)
}

/** Passwort ändern. */
function PasswordPanel() {
	const notify = useNotify()
	const [current, setCurrent] = useState("")
	const [next, setNext] = useState("")
	const [confirm, setConfirm] = useState("")
	const [busy, setBusy] = useState(false)

	async function submit(e) {
		e.preventDefault()
		const problem = passwordProblem(next)
		if (problem) { notify("Fehler", problem, "error"); return }
		if (next !== confirm) { notify("Fehler", "Die Passwörter stimmen nicht überein.", "error"); return }
		setBusy(true)
		try {
			await sendChecked("/api/account/change-password", { currentPassword: current, newPassword: next })
			persistImportant(notify, { type: "success", title: "Passwort geändert", message: "Dein Anmeldepasswort wurde erfolgreich geändert." })
			setCurrent(""); setNext(""); setConfirm("")
		} catch (err) {
			notifyError(notify, err, { context: "Passwort konnte nicht geändert werden" })
		} finally { setBusy(false) }
	}

	return (
		<form className="hud-frame flex flex-col gap-3 p-4" onSubmit={submit}>
			<PasswordField label="Aktuelles Passwort" value={current} onChange={e => setCurrent(e.target.value)} autoComplete="current-password" />
			<PasswordField label="Neues Passwort" value={next} onChange={e => setNext(e.target.value)} placeholder="8–72 Zeichen, mind. 1 Buchstabe & 1 Ziffer" autoComplete="new-password" />
			<PasswordField label="Neues Passwort bestätigen" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Passwort wiederholen" autoComplete="new-password" />
			<div>
				<button type="submit" className="cta cta-primary" disabled={busy || !current || !next || !confirm}>{busy ? "Speichern…" : "Passwort ändern"}</button>
			</div>
		</form>
	)
}

/** 2FA aktivieren/deaktivieren (TOTP). `enabled` + `setEnabled` kommen vom Abschnitt (geteilter Load). */
function TwoFactorPanel({ enabled, setEnabled }) {
	const notify = useNotify()
	const [phase, setPhase] = useState("idle")   // idle | setup | codes | disable
	const [qr, setQr] = useState("")
	const [secret, setSecret] = useState("")
	const [code, setCode] = useState("")
	const [backup, setBackup] = useState([])
	const [busy, setBusy] = useState(false)

	async function startSetup() {
		setBusy(true)
		try {
			const d = await getChecked("/api/2fa/generate")
			setQr(d.url || ""); setSecret(d.secret || ""); setCode(""); setPhase("setup")
		} catch (err) { notifyError(notify, err, { context: "2FA konnte nicht gestartet werden" }) } finally { setBusy(false) }
	}
	async function confirmEnable() {
		setBusy(true)
		try {
			const d = await sendChecked("/api/2fa/enable", { code })
			setBackup(Array.isArray(d?.codes) ? d.codes : []); setPhase("codes"); setEnabled(true)
			persistImportant(notify, { type: "success", title: "Zwei-Faktor-Authentifizierung aktiviert", message: "Dein Konto ist jetzt zusätzlich per Authenticator-App geschützt." })
		} catch (err) { notifyError(notify, err, { context: "2FA konnte nicht aktiviert werden" }) } finally { setBusy(false) }
	}
	async function confirmDisable() {
		setBusy(true)
		try {
			await sendChecked("/api/2fa/disable", { code })
			setEnabled(false); setPhase("idle"); setCode("")
			persistImportant(notify, { type: "warning", title: "Zwei-Faktor-Authentifizierung deaktiviert", message: "Der zusätzliche Schutz per Authenticator-App ist jetzt aus." })
		} catch (err) { notifyError(notify, err, { context: "2FA konnte nicht deaktiviert werden" }) } finally { setBusy(false) }
	}

	return (
		<div className="hud-frame flex flex-col gap-3 p-4">
			<div className="flex items-center justify-between gap-3">
				<div>
					<p className="m-0 mt-0.5 text-sm text-text-muted">
						{enabled ? "Aktiv – dein Konto ist mit einer Authenticator-App geschützt." : "Schütze dein Konto mit einer Authenticator-App (TOTP)."}
					</p>
				</div>
				{enabled === false && phase === "idle" && (
					<button className="cta cta-primary whitespace-nowrap" onClick={startSetup} disabled={busy}>Aktivieren</button>
				)}
				{enabled === true && phase === "idle" && (
					<button className="cta cta-danger whitespace-nowrap" onClick={() => { setPhase("disable"); setCode("") }}>Deaktivieren</button>
				)}
			</div>

			{phase === "setup" && (
				<div className="flex flex-col gap-3 border-t border-border pt-3">
					<p className="m-0 text-sm text-text-secondary">Scanne den QR-Code mit deiner Authenticator-App – oder gib das Geheimnis manuell ein:</p>
					<div className="flex flex-wrap items-center gap-4">
						{qr && <img src={qr} alt="2FA QR-Code" width={160} height={160} className="rounded bg-white p-2" />}
						{secret && <code className="select-all break-all rounded bg-bg-2 px-2 py-1 font-mono text-sm text-neon-green">{secret}</code>}
					</div>
					<label className="block">
						<span className="mb-1.5 block text-sm font-bold text-text-secondary">6-stelliger Code aus der App</span>
						<input className={inputCls} value={code} onChange={e => setCode(e.target.value)} placeholder="123456" inputMode="numeric" autoComplete="one-time-code" />
					</label>
					<div className="flex gap-2">
						<button className="cta cta-primary" onClick={confirmEnable} disabled={busy || code.length < 6}>{busy ? "Prüfen…" : "Bestätigen & aktivieren"}</button>
						<button className="cta cta-secondary" onClick={() => setPhase("idle")} disabled={busy}>Abbrechen</button>
					</div>
				</div>
			)}

			{phase === "codes" && (
				<div className="flex flex-col gap-3 border-t border-border pt-3">
					<p className="m-0 text-sm text-text-secondary"><strong>Backup-Codes</strong> – bewahre sie sicher auf. Jeder Code funktioniert einmal, falls du keinen Zugriff auf deine App hast.</p>
					<div className="grid grid-cols-2 gap-2 rounded bg-bg-2 p-3 font-mono text-sm text-text-primary sm:grid-cols-3">
						{backup.map((c, i) => <span key={i} className="select-all">{c}</span>)}
					</div>
					<div className="flex gap-2">
						<button className="cta cta-secondary" onClick={() => navigator.clipboard?.writeText(backup.join("\n")).then(() => notify("Kopiert", "Backup-Codes in die Zwischenablage kopiert.", "success"))}>
							<i className="bi bi-clipboard" aria-hidden="true" /> Kopieren
						</button>
						<button className="cta cta-secondary" onClick={() => setPhase("idle")}>Fertig</button>
					</div>
				</div>
			)}

			{phase === "disable" && (
				<div className="flex flex-col gap-3 border-t border-border pt-3">
					<label className="block">
						<span className="mb-1.5 block text-sm font-bold text-text-secondary">Zum Deaktivieren aktuellen Code eingeben</span>
						<input className={inputCls} value={code} onChange={e => setCode(e.target.value)} placeholder="123456 oder Backup-Code" autoComplete="one-time-code" />
					</label>
					<div className="flex gap-2">
						<button className="cta cta-danger" onClick={confirmDisable} disabled={busy || code.length < 6}>{busy ? "Prüfen…" : "2FA deaktivieren"}</button>
						<button className="cta cta-secondary" onClick={() => { setPhase("idle"); setCode("") }} disabled={busy}>Abbrechen</button>
					</div>
				</div>
			)}
		</div>
	)
}

// Menschliche Anzeige der (flachen) Session-Felder aus der API.
const KNOWN = v => v && v !== "unknown" && v !== "undefined"
function deviceIcon(type) {
	const t = String(type || "").toLowerCase()
	if (t.includes("mobile") || t.includes("phone")) return "bi-phone"
	if (t.includes("tablet")) return "bi-tablet"
	return "bi-pc-display"
}
function deviceTitle(s) {
	const parts = []
	if (KNOWN(s.browser)) parts.push(s.browser)
	if (KNOWN(s.os)) parts.push(parts.length ? "auf " + s.os : s.os)
	if (parts.length) return parts.join(" ")
	if (KNOWN(s.type)) return s.type
	return "Unbekanntes Gerät"
}
function locationText(s) {
	const parts = [s.region, s.country].filter(KNOWN)
	return parts.length ? parts.join(", ") : null
}
function loginMethodText(m) {
	const map = { password: "Passwort", google: "Google", github: "GitHub", discord: "Discord" }
	return KNOWN(m) ? (map[m] || m) : null
}
function formatWhen(iso) {
	if (!iso) return null
	const d = new Date(iso)
	if (Number.isNaN(d.getTime())) return null
	return d.toLocaleString("de-DE", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

/** Aktive Sitzungen mit echten Gerätedaten anzeigen und abmelden. `currentId` kommt vom Abschnitt. */
function SessionsPanel({ currentId }) {
	const notify = useNotify()
	const [sessions, setSessions] = useState(null)
	const [error, setError] = useState(null)

	function load(retry = false) {
		setError(null)
		setSessions(null)
		const settle = minSettle(retry)
		getChecked("/api/account/sessions").then(d => settle(() => setSessions(Array.isArray(d) ? d : []))).catch(e => settle(() => setError(e)))
	}
	useEffect(load, [])

	async function invalidate(sessionId) {
		try { await sendChecked("/api/account/sessions/invalidate", { sessionId }); notify("Abgemeldet", "Sitzung wurde beendet.", "note"); load() }
		catch (err) { notifyError(notify, err, { context: "Sitzung konnte nicht beendet werden" }) }
	}
	async function invalidateAll() {
		try { await sendChecked("/api/account/sessions/invalidateAll", {}); notify("Abgemeldet", "Alle anderen Sitzungen wurden beendet.", "note"); load() }
		catch (err) { notifyError(notify, err, { context: "Sitzungen konnten nicht beendet werden" }) }
	}

	return (
		<div className="hud-frame flex flex-col gap-3 p-4">
			<div className="flex items-center justify-end gap-3">
				<button className="cta cta-secondary whitespace-nowrap text-sm !px-3 !py-1.5" onClick={invalidateAll} disabled={sessions === null}>Alle anderen abmelden</button>
			</div>
			{error ? (
				<ErrorState error={error} onRetry={() => load(true)} variant="inline" />
			) : sessions === null ? (
				<SessionsSkeleton />
			) : sessions.length === 0 ? (
				<p className="m-0 text-sm text-text-muted">Keine weiteren Sitzungen.</p>
			) : (
				<ul className="flex flex-col gap-2">
					{sessions.map((s, i) => {
						const id = s.sessionId || i
						const isCurrent = currentId && s.sessionId === currentId
						const loc = locationText(s)
						const method = loginMethodText(s.loginMethod)
						const when = formatWhen(s.lastActivity || s.createdAt)
						const activity = isCurrent ? "Jetzt aktiv" : (when && `zuletzt aktiv ${when}`)
						return (
							<li key={id} className="flex items-center justify-between gap-3 rounded border border-border bg-bg-2 px-3 py-2.5">
								<div className="flex min-w-0 items-center gap-3">
									<i className={`bi ${deviceIcon(s.type)} text-xl text-text-secondary`} aria-hidden="true" />
									<div className="min-w-0">
										<p className="m-0 flex items-center gap-2 truncate text-sm font-bold text-text-primary">
											{deviceTitle(s)}
											{isCurrent && <span className="rounded-full bg-neon-green/15 px-2 py-0.5 font-pixel text-[9px] uppercase text-neon-green">Dieses Gerät</span>}
											{String(s.twoFactor) === "true" && <i className="bi bi-shield-check text-neon-green" title="Mit 2FA angemeldet" aria-hidden="true" />}
										</p>
										<p className="m-0 mt-0.5 truncate text-xs text-text-muted">
											{[loc, method && `via ${method}`, activity].filter(Boolean).join(" · ") || "Keine weiteren Details"}
										</p>
									</div>
								</div>
								{!isCurrent && (
									<button className="cta cta-secondary shrink-0 text-sm !px-3 !py-1.5" onClick={() => invalidate(s.sessionId)}>Abmelden</button>
								)}
							</li>
						)
					})}
				</ul>
			)}
		</div>
	)
}

export default function SicherheitSection() {
	// Sicherheits-Status EINMAL laden (früher doppelt: 2FA- und Sessions-Panel). Liefert den
	// 2FA-Zustand + die aktuelle Session-id und dient als gemeinsames Lade-Signal, damit alle drei
	// Panels (inkl. Passwort) ihr Skeleton zeigen, solange geladen wird.
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState(null)
	const [enabled, setEnabled] = useState(false)
	const [currentId, setCurrentId] = useState(null)

	function loadSecurity(retry = false) {
		setError(null)
		setLoading(true)
		const settle = minSettle(retry)
		getChecked("/api/account/security")
			.then(d => settle(() => {
				setEnabled(String(d?.twoFactor) === "true")
				setCurrentId(d?.sessionId || null)
				setLoading(false)
			}))
			.catch(e => settle(() => { setError(e); setLoading(false) }))
	}
	useEffect(loadSecurity, [])

	return (
		<section className="settings-section">
			<header className="settings-section__head">
				<h3 className="settings-section__title">Sicherheit</h3>
				<p className="settings-section__sub">Passwort, Zwei-Faktor-Authentifizierung und aktive Sitzungen.</p>
			</header>
			<SettingGroup title="Passwort" sub="Ändere dein Anmeldepasswort.">
				{loading ? (
					<PasswordSkeleton />
				) : error ? (
					<ErrorState error={error} onRetry={() => loadSecurity(true)} variant="inline" />
				) : (
					<PasswordPanel />
				)}
			</SettingGroup>
			<SettingGroup title="Zwei-Faktor-Authentifizierung" sub="Zusätzlicher Schutz per Authenticator-App.">
				{loading ? (
					<TwoFactorSkeleton />
				) : error ? (
					<ErrorState error={error} onRetry={() => loadSecurity(true)} variant="inline" />
				) : (
					<TwoFactorPanel enabled={enabled} setEnabled={setEnabled} />
				)}
			</SettingGroup>
			<SettingGroup title="Aktive Sitzungen" sub="Geräte, auf denen du gerade angemeldet bist.">
				<SessionsPanel currentId={currentId} />
			</SettingGroup>
		</section>
	)
}
