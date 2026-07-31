/**
 * Gemeinsame Alternativ-Anzeige für fehlgeschlagenes Laden UND leere Zustände.
 * Ersetzt die früher handgebauten `.store-unavailable`-Blöcke und benennt bei Fehlern die
 * Ursache (offline / Server nicht erreichbar / Serverfehler / nicht gefunden / Sitzung).
 *
 * Verwendung:
 *   <ErrorState error={err} onRetry={load} />                         // Fehler mit Retry
 *   <ErrorState variant="empty" icon="bi-controller"                  // echter Leer-Zustand
 *               title="Noch nichts installiert" message="…"
 *               action={{ label: "Zum Store", to: "/store" }} />
 */
import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { useNotify } from "../lib/notifications.jsx"
import { fadeUp } from "../lib/motion.js"
import { CAUSE, describeCauseSync, resolveCause, notifyRetryFailed } from "../lib/loadError.js"
import { cn } from "@/lib/utils"

// Überlebt bewusst das Un-/Remounten von ErrorState: manche Seiten tauschen bei „Erneut
// versuchen" kurz auf ein Skeleton (ErrorState unmountet) und zeigen bei erneutem Fehlschlag
// ein FRISCHES ErrorState. Dieser Zeitstempel lässt uns den Fehlschlag trotzdem als Toast melden.
let lastRetryAt = 0
const RETRY_TOAST_WINDOW = 6000

// Ursache → Icon, Überschrift, Text, ob ein „Erneut versuchen" sinnvoll ist.
const CAUSE_UI = {
	[CAUSE.OFFLINE]: {
		icon: "bi-wifi-off",
		title: "Keine Internetverbindung",
		message: "Du bist offline. Prüfe deine Verbindung und versuch es erneut.",
		retryable: true,
	},
	[CAUSE.SERVER_UNREACHABLE]: {
		icon: "bi-plug",
		title: "Server nicht erreichbar",
		message: "Unsere Server sind gerade nicht erreichbar. Bitte versuch es in ein paar Minuten erneut.",
		retryable: true,
	},
	[CAUSE.SERVER_ERROR]: {
		icon: "bi-exclamation-triangle",
		title: "Etwas ist schiefgelaufen",
		message: "Beim Laden ist ein Fehler aufgetreten. Bitte versuch es später erneut.",
		retryable: true,
	},
	[CAUSE.NOT_FOUND]: {
		icon: "bi-question-circle",
		title: "Nicht gefunden",
		message: "Das Gesuchte gibt es nicht (mehr).",
		retryable: false,
	},
	[CAUSE.SESSION]: {
		icon: "bi-box-arrow-in-right",
		title: "Sitzung abgelaufen",
		message: "Bitte melde dich erneut an.",
		retryable: false,
	},
	[CAUSE.UNKNOWN]: {
		icon: "bi-exclamation-octagon",
		title: "Unerwarteter Fehler",
		message: "Etwas hat nicht geklappt. Bitte versuch es erneut.",
		retryable: true,
	},
}

function ActionButton({ action }) {
	if (!action) return null
	const cls = "cta cta-secondary !px-3.5 !py-1.5 text-sm"
	if (action.to) {
		return <Link to={action.to} className={cls}>{action.label}</Link>
	}
	return <button className={cls} onClick={action.onClick}>{action.label}</button>
}

export default function ErrorState({ error, cause: causeProp, variant = "page", onRetry, icon, title, message, action }) {
	const isEmpty = variant === "empty"
	const notify = useNotify()
	// Bei Fehlern: sofort grobe Ursache, dann per Netz-Probe verfeinern.
	const [cause, setCause] = useState(() => causeProp || (error ? describeCauseSync(error) : null))
	const [busy, setBusy] = useState(false)

	useEffect(() => {
		if (isEmpty || causeProp || !error) return
		let alive = true
		resolveCause(error).then(c => { if (alive) setCause(c) })
		return () => { alive = false }
	}, [error, causeProp, isEmpty])

	// Schlägt „Erneut versuchen" wieder fehl, erscheint (kurz nach dem Klick) erneut ein Fehler —
	// das melden wir zusätzlich als In-App-Toast. Der Toast erscheint erst ~1s nach dem Klick,
	// synchron zum Button-Ladekreis (nicht sofort aufblitzen).
	useEffect(() => {
		if (isEmpty || !error) return
		if (!lastRetryAt || Date.now() - lastRetryAt >= RETRY_TOAST_WINDOW) return
		const delay = Math.max(0, 1000 - (Date.now() - lastRetryAt))
		lastRetryAt = 0
		const t = setTimeout(() => notifyRetryFailed(notify, error), delay)
		return () => clearTimeout(t)
	}, [error, isEmpty, notify])

	// Inhalte bestimmen: Empty/expliziter Fall nutzt die Props, Fehler die Ursachen-Map.
	const ui = (!isEmpty && cause && CAUSE_UI[cause]) || CAUSE_UI[CAUSE.UNKNOWN]
	const finalIcon = icon || (isEmpty ? "bi-inbox" : ui.icon)
	const finalTitle = title || (isEmpty ? "Nichts vorhanden" : ui.title)
	const finalMessage = message ?? (isEmpty ? "" : ui.message)
	const showRetry = !isEmpty && ui.retryable && typeof onRetry === "function"

	async function handleRetry() {
		if (busy) return
		lastRetryAt = Date.now() // markiert den Versuch → ein danach auftauchender Fehler wird getoastet
		setBusy(true)
		// Ladekreis mindestens 1s laufen lassen — auch wenn onRetry sofort zurückkehrt, sieht der
		// Nutzer so eine klare Reaktion auf den Klick (kein Aufblitzen).
		try {
			await Promise.all([
				Promise.resolve().then(onRetry),
				new Promise(resolve => setTimeout(resolve, 1000)),
			])
		} finally { setBusy(false) }
	}

	const box = (
		<motion.div
			variants={fadeUp}
			initial="initial"
			animate="animate"
			className={cn("store-unavailable hud-frame", variant === "inline" && "!my-4 !py-7", variant === "page" && "!my-0")}
			role="status"
		>
			<span className={cn("bi", finalIcon)} aria-hidden="true" />
			<h2>{finalTitle}</h2>
			{finalMessage && <p>{finalMessage}</p>}
			{(showRetry || action) && (
				<div className="mt-2 flex flex-wrap items-center justify-center gap-2">
					{showRetry && (
						<button className="cta cta-primary !px-3.5 !py-1.5 text-sm" onClick={handleRetry} disabled={busy}>
							<i className={cn("bi text-current", busy ? "bi-arrow-repeat animate-spin" : "bi-arrow-clockwise")} aria-hidden="true" />
							{busy ? " Wird geladen…" : " Erneut versuchen"}
						</button>
					)}
					<ActionButton action={action} />
				</div>
			)}
		</motion.div>
	)

	// „page"-Variante immer mittig (horizontal + vertikal) im verfügbaren Raum zeigen.
	if (variant === "page") {
		return <div className="grid min-h-[60vh] w-full place-items-center">{box}</div>
	}
	return box
}
