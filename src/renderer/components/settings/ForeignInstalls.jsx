import { useCallback, useEffect, useState } from "react"
import { get } from "../../lib/api.js"
import { useGameActions } from "../../lib/gameActions.jsx"
import CoverImage from "../CoverImage.jsx"

/**
 * „Fremde Installationen" — Spiele, die auf diesem PC installiert sind, aber dem angemeldeten
 * Konto nicht gehören (keine Lizenz). Sie tauchen bewusst nicht in der Bibliothek auf und lassen
 * sich nicht starten; die Dateien bleiben aber liegen, damit sie beim Rückwechsel (oder nach dem
 * Erwerb) sofort wieder nutzbar sind. Hier kann man den Platz freigeben.
 *
 * `/api/installs` liefert die Liste als `foreign` — die Lizenzlogik bleibt im Hauptprozess.
 * Löschen läuft über den bestehenden Weg (Rückfrage-Dialog + Toast) aus lib/gameActions.jsx.
 */
function formatSize(bytes) {
	if (!Number.isFinite(bytes) || bytes <= 0) return null
	const units = ["B", "KB", "MB", "GB"]
	let value = bytes
	let i = 0
	while (value >= 1024 && i < units.length - 1) { value /= 1024; i++ }
	return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`
}

export default function ForeignInstalls() {
	const [items, setItems] = useState([])
	const { remove } = useGameActions()

	const load = useCallback(() => {
		get("/api/installs")
			.then(d => setItems(Array.isArray(d?.foreign) ? d.foreign : []))
			.catch(() => setItems([]))
	}, [])
	useEffect(load, [load])

	if (items.length === 0) return null

	return (
		<div className="hud-frame mt-4 p-4">
			<label className="mb-1.5 block font-bold text-text-primary">Fremde Installationen</label>
			<p className="m-0 mb-3 text-sm text-text-muted">
				Diese Spiele liegen auf dem PC, gehören aber nicht zu deinem Konto. Hol sie dir im Store, um sie
				zu spielen — oder gib den Speicherplatz frei.
			</p>
			<ul className="m-0 flex list-none flex-col gap-2 p-0">
				{items.map(item => {
					const size = formatSize(item.size)
					return (
						<li key={item.name} className="flex items-center gap-3 rounded-lg border border-border bg-bg-2 p-2.5">
							<span className="relative block h-10 w-16 shrink-0 overflow-hidden rounded">
								<CoverImage
									src={`/api/library/img/${encodeURIComponent(item.name)}`}
									alt=""
									className="h-full w-full object-cover"
								/>
							</span>
							<span className="min-w-0 flex-1">
								<span className="block truncate font-bold text-text-primary">{item.title || item.name}</span>
								<span className="block truncate text-sm text-text-muted">
									{size ? `${size} · ` : ""}
									{item.installationPath || ""}
								</span>
							</span>
							<button
								className="cta cta-secondary !px-3 !py-2 whitespace-nowrap text-sm"
								onClick={() => remove(item, load)}
								aria-label={`${item.title || item.name} löschen`}
							>
								<i className="bi bi-trash" aria-hidden="true" /> Löschen
							</button>
						</li>
					)
				})}
			</ul>
		</div>
	)
}
