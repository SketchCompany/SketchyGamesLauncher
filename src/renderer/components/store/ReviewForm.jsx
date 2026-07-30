import { useState } from "react"
import { send } from "../../lib/api.js"
import { useNotify } from "../../lib/notifications.jsx"

const MIN = 40

/**
 * Rezensions-Formular: Empfehlung wählen + Text (≥ 40 Zeichen). `hoursPlayed` wird mitgeschickt.
 *
 * Seit P5 lässt sich die Empfehlung auch beim Bearbeiten umdrehen. Vorher war sie ab der
 * Erstabgabe gesperrt — das ging, solange die 1–5-Sterne ein zweiter Kanal waren. Als einzige
 * Stimme muss sie revidierbar sein, sonst steht man nach einem Patch dauerhaft mit einem Urteil
 * da, das man nicht mehr vertritt.
 */
export default function ReviewForm({ gameId, initial = null, hoursPlayed = 0, onDone, onCancel }) {
	const notify = useNotify()
	const editing = !!initial
	const [recommended, setRecommended] = useState(initial ? initial.recommended : null)
	const [text, setText] = useState(initial?.text || "")
	const [busy, setBusy] = useState(false)

	const len = text.trim().length
	const valid = len >= MIN && recommended !== null

	async function submit(e) {
		e.preventDefault()
		if (!valid || busy) return
		setBusy(true)
		try {
			// raw=true → volles Envelope prüfen (der lokale Proxy meldet Fehler als {status:0} mit HTTP 200).
			const res = await send(`/api/store/${encodeURIComponent(gameId)}/review`, {
				recommended,
				text: text.trim(),
				hoursPlayed,
			}, true)
			if (!res || res.status !== 1) throw new Error(typeof res?.data === "string" ? res.data : "Unbekannter Fehler")
			notify("Danke!", editing ? "Deine Rezension wurde aktualisiert." : "Deine Rezension wurde veröffentlicht.", "success")
			onDone?.()
		} catch (err) {
			notify("Fehler", "Rezension konnte nicht gespeichert werden: " + (err?.message || err), "error")
		} finally {
			setBusy(false)
		}
	}

	return (
		<form className="review-form hud-frame" onSubmit={submit}>
			<p className="review-form__title">{editing ? "Deine Rezension bearbeiten" : "Rezension schreiben"}</p>
			<div className="review-form__verdict">
				<button
					type="button"
					className={`review-form__thumb is-up${recommended === true ? " active" : ""}`}
					onClick={() => setRecommended(true)}
					aria-pressed={recommended === true}
				>
					<span className="bi bi-hand-thumbs-up" aria-hidden="true" /> Empfehlen
				</button>
				<button
					type="button"
					className={`review-form__thumb is-down${recommended === false ? " active" : ""}`}
					onClick={() => setRecommended(false)}
					aria-pressed={recommended === false}
				>
					<span className="bi bi-hand-thumbs-down" aria-hidden="true" /> Nicht empfehlen
				</button>
			</div>
			{editing && <p className="review-form__hint">Du kannst deine Empfehlung umdrehen und den Text ändern.</p>}
			<textarea
				className="review-form__text"
				value={text}
				onChange={e => setText(e.target.value)}
				placeholder="Was macht dieses Spiel (nicht) empfehlenswert? Mindestens 40 Zeichen."
				rows={4}
				maxLength={4000}
			/>
			<div className="review-form__foot">
				<span className={`review-form__count${len < MIN ? " is-short" : ""}`}>{len}/{MIN}</span>
				<div className="review-form__actions">
					{editing && onCancel && (
						<button type="button" className="cta cta-secondary" onClick={onCancel} disabled={busy}>
							Abbrechen
						</button>
					)}
					<button type="submit" className="cta cta-primary" disabled={!valid || busy}>
						{busy ? "Speichert…" : editing ? "Aktualisieren" : "Veröffentlichen"}
					</button>
				</div>
			</div>
		</form>
	)
}
