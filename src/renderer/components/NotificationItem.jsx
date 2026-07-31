/**
 * Gemeinsame Darstellung EINER Benachrichtigung — genutzt vom Toast-Stapel UND vom Glocken-Fenster,
 * damit beide identisch aussehen. Zeigt Typ-Akzent + Titel + Text und optional unten eine Reihe
 * KLEINER Aktions-Buttons (damit die Nachricht kompakt bleibt).
 *
 * Aktionen sind rein deklarativ ({ kind, label, … }); die Zuordnung kind→Effekt macht
 * useNotificationActions (lib/notificationActions.jsx). Nach einer Aktion wird onAfterAction
 * aufgerufen (die Eltern entfernen die Benachrichtigung — gewünschtes Verhalten).
 */
import { useState } from "react"
import { useNotificationActions } from "../lib/notificationActions.jsx"
import { cn } from "@/lib/utils"

// Akzentfarbe je Typ (identisch in Toast + Glocke).
export const TYPE_ACCENT = {
	success: "border-l-neon-green",
	error: "border-l-error",
	warning: "border-l-neon-amber",
	note: "border-l-neon-cyan",
}

export default function NotificationItem({ notification, onAfterAction, onClose, showClose, hoverClose, className }) {
	const run = useNotificationActions()
	const { type, title, message, actions, pinned } = notification
	const [busy, setBusy] = useState(false)

	async function handleAction(a) {
		if (busy) return
		setBusy(true)
		try { await run(a) } finally { setBusy(false) }
		onAfterAction?.(notification)
	}

	return (
		<div
			className={cn(
				"group/notif relative rounded-lg border border-border-strong border-l-2 bg-bg-2/95 px-3.5 py-2.5 backdrop-blur",
				showClose && "pr-8",
				TYPE_ACCENT[type] || "border-l-border-strong",
				className,
			)}
			role="status"
		>
			{showClose && !pinned && (
				<button
					className={cn(
						"absolute right-1 top-1 grid size-6 cursor-pointer place-items-center rounded text-text-muted transition-opacity duration-150 hover:bg-accent hover:text-text-primary",
						// „Kleines x einblenden": im Toast erst bei Hover/Fokus sanft einblenden.
						hoverClose && "opacity-0 group-hover/notif:opacity-100 group-focus-within/notif:opacity-100 focus-visible:opacity-100",
					)}
					onClick={() => onClose?.(notification)}
					aria-label="Schließen"
				>
					<i className="bi bi-x-lg text-[10px]" aria-hidden="true" />
				</button>
			)}
			<div className="text-sm font-bold text-text-primary">{title}</div>
			{message && <div className="mt-0.5 text-xs leading-relaxed text-text-secondary">{message}</div>}
			{Array.isArray(actions) && actions.length > 0 && (
				<div className="mt-2 flex flex-wrap gap-1.5">
					{actions.map((a, i) => (
						<button
							key={i}
							className="cta cta-secondary !px-2.5 !py-1 text-xs"
							onClick={() => handleAction(a)}
							disabled={busy}
						>
							{a.label}
						</button>
					))}
				</div>
			)}
		</div>
	)
}
