import { useEffect, useRef, useState } from "react"
import { send, openExternal } from "../../lib/api.js"
import { useNotify } from "../../lib/notifications.jsx"
import { formatPrice } from "./gameUi.js"

/**
 * „Zahl so viel du möchtest" — der Dialog vor dem Herunterladen eines kostenlosen Spiels.
 *
 * Der Ablauf ist derselbe wie in der Web-App: Betrag eintippen → als **Wunsch** an die API → die
 * prüft ihn gegen die Grenzen und fordert damit dynamisch ein Xsolla-Token über exakt diesen
 * Betrag an. Kein virtuelles Guthaben, kein Restbetrag, kein Zwischenschritt.
 *
 * Die Bezahlseite wird über `openExternal` im **Systembrowser** geöffnet, nie im Electron-Fenster:
 * dort verliert sie ihren Origin-/CSP-Kontext, und die 3-D-Secure-Weiterleitungen der Banken
 * brechen ab. (Derselbe Weg, den schon der OAuth-Login nimmt.)
 */

/** „5" / „5,00" / „5.00" → 500 Cent. Leer oder Unsinn → null. */
function parseAmount(raw) {
	const normalized = String(raw).trim().replace(",", ".")
	if (!/^\d+(\.\d{0,2})?$/.test(normalized)) return null
	const cents = Math.round(Number(normalized) * 100)
	return Number.isFinite(cents) && cents > 0 ? cents : null
}

export default function DonateModal({ gameId, gameTitle, info, onClose, onSkip, skipLabel = "Ohne Betrag fortfahren" }) {
	const notify = useNotify()
	const [raw, setRaw] = useState(() => (info.suggestedCents?.[0] ? String(info.suggestedCents[0] / 100) : ""))
	const [busy, setBusy] = useState(false)
	const inputRef = useRef(null)

	useEffect(() => {
		inputRef.current?.focus()
		const onKey = e => {
			if (e.key === "Escape") onClose?.()
		}
		document.addEventListener("keydown", onKey)
		return () => document.removeEventListener("keydown", onKey)
	}, [onClose])

	const cents = parseAmount(raw)
	const tooLow = cents !== null && cents < info.minCents
	const tooHigh = cents !== null && cents > info.maxCents

	async function donate() {
		if (cents === null || tooLow || tooHigh || busy) return
		setBusy(true)
		try {
			// raw=true → volles Envelope prüfen (der lokale Proxy meldet Fehler als {status:0} mit HTTP 200).
			const res = await send(`/api/checkout/donation/${encodeURIComponent(gameId)}`, { amountCents: cents }, true)
			if (!res || res.status !== 1 || !res.data?.url) throw new Error(typeof res?.data === "string" ? res.data : "Der Bezahlvorgang konnte nicht gestartet werden.")
			await openExternal(res.data.url)
			notify("Bezahlseite geöffnet", "Schließe sie, wenn du fertig bist — dein Download wartet hier.", "info")
			onClose?.()
		} catch (err) {
			notify("Fehler", String(err?.message || err), "error")
		} finally {
			setBusy(false)
		}
	}

	return (
		<div className="donate-modal__backdrop" role="dialog" aria-modal="true" aria-labelledby="donate-modal-title" onClick={onClose}>
			<div className="donate-modal" onClick={e => e.stopPropagation()}>
				<button type="button" className="donate-modal__close" onClick={onClose} aria-label="Schließen">
					<span className="bi bi-x-lg" aria-hidden="true" />
				</button>

				<h2 id="donate-modal-title" className="donate-modal__title">
					{gameTitle} unterstützen
				</h2>
				<p className="donate-modal__lead">Dieses Spiel ist kostenlos. Wenn du magst, kannst du freiwillig etwas dalassen — der Betrag geht an das Studio hinter dem Spiel.</p>

				<div className="donate-modal__chips">
					{(info.suggestedCents || []).map(c => (
						<button key={c} type="button" className={"donate-modal__chip" + (cents === c ? " donate-modal__chip--active" : "")} onClick={() => setRaw(String(c / 100))}>
							{formatPrice(c)}
						</button>
					))}
				</div>

				<label className="donate-modal__field">
					<span className="donate-modal__label">Eigener Betrag</span>
					<span className="donate-modal__input-wrap">
						<input ref={inputRef} type="text" inputMode="decimal" value={raw} onChange={e => setRaw(e.target.value)} onKeyDown={e => e.key === "Enter" && donate()} className="donate-modal__input" aria-label="Betrag in Euro" placeholder="5,00" />
						<span className="donate-modal__currency">€</span>
					</span>
				</label>

				<p className="donate-modal__hint">{tooLow ? `Mindestens ${formatPrice(info.minCents)}.` : tooHigh ? `Höchstens ${formatPrice(info.maxCents)}.` : cents === null && raw.trim() !== "" ? "Bitte einen Betrag wie 5,00 eingeben." : `Zwischen ${formatPrice(info.minCents)} und ${formatPrice(info.maxCents)}.`}</p>

				<div className="donate-modal__actions">
					<button type="button" className="cta cta-primary donate-modal__pay" onClick={donate} disabled={busy || cents === null || tooLow || tooHigh}>
						<span className="bi bi-heart-fill" aria-hidden="true" /> {busy ? "Öffnet…" : cents !== null && !tooLow && !tooHigh ? `${formatPrice(cents)} geben` : "Betrag geben"}
					</button>
					{/* Der Weg ohne Zahlung MUSS gleichwertig erreichbar sein — das Spiel ist kostenlos. */}
					<button type="button" className="cta cta-secondary donate-modal__skip" onClick={onSkip} disabled={busy}>
						{skipLabel}
					</button>
				</div>

				<p className="donate-modal__note">Die Bezahlung läuft über Xsolla im Systembrowser. Kartendaten erreichen den Launcher nie.</p>
			</div>
		</div>
	)
}
