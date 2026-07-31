import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { get } from "../lib/api.js"
import { useNotify } from "../lib/notifications.jsx"
import { useGameActions } from "../lib/gameActions.jsx"
import GameContextMenu from "../components/GameContextMenu.jsx"
import CoverImage from "../components/CoverImage.jsx"
import ErrorState from "../components/ErrorState.jsx"
import { GameCardSkeleton } from "../components/Skeletons.jsx"
import { staggerContainer, staggerItem, hoverLift, STAGGER_CAP } from "../lib/motion.js"
import { minSettle } from "../lib/minDelay.js"

/** Bibliothek: lokale Daten → Kopf rendert sofort; das Grid zeigt kurz ein Skeleton, bis /api/installs da ist. */
export default function Library() {
	const [installs, setInstalls] = useState(null)
	const [error, setError] = useState(null)
	const [query, setQuery] = useState("")
	const notify = useNotify()
	// Start/Ordner/Deinstallieren zentral — inkl. Start-Overlay (lib/launchOverlay.jsx).
	const { play, openFolder, remove, launchingName } = useGameActions()

	// Fehler NICHT mehr zu „leer" kollabieren — sonst sieht ein Ladefehler wie eine leere
	// Bibliothek aus. null=lädt, Fehler→error, sonst echte Daten. Bei Retry bleibt das Skeleton
	// mind. 1s sichtbar (minSettle), damit es nicht aufblitzt.
	const load = (retry = false) => {
		setError(null)
		setInstalls(null)
		const settle = minSettle(retry)
		get("/api/installs").then(d => settle(() => setInstalls(d))).catch(e => settle(() => setError(e)))
	}
	useEffect(() => load(false), [])

	const items = useMemo(() => {
		if (!installs) return []
		let all = installs.games || []
		const q = query.trim().toLowerCase()
		if (q) all = all.filter(x => (x.title || x.name || "").toLowerCase().includes(q))
		return all
	}, [installs, query])

	async function checkUpdates() {
		notify("Update-Suche", "Suche nach Updates…", "note", 3000)
		try {
			const updates = await get("/api/updates/pull")
			// Gefundene Updates melden die persistenten „Update verfügbar"-Benachrichtigungen selbst;
			// hier nur bei „nichts gefunden" kurz Bescheid geben.
			if (Array.isArray(updates) && updates.length === 0) {
				notify("Update-Suche", "Alles aktuell — keine Updates gefunden.", "note", 4000)
			}
		} catch (err) {
			// /api/updates/pull meldet fehlende Verbindung/Serverfehler als lesbaren Text → Warnung.
			notify("Update-Suche fehlgeschlagen", err?.message || "Bitte versuch es später erneut.", "warning")
		}
	}

	return (
		<div className="page">
			<div className="mb-6 flex flex-wrap items-center gap-2">
				<h2 className="section-title">
					<span className="bi bi-controller" aria-hidden="true" /> Bibliothek
				</h2>
				<span className="flex-1" />
				{/* Optik wie die Store-Suchleiste (.store-search): weicher Rand, rounded-lg, kein Neon-Fokus. */}
				<input
					placeholder="Suchen…"
					value={query}
					onChange={e => setQuery(e.target.value)}
					aria-label="Bibliothek durchsuchen"
					className="h-10 w-55 rounded-lg border border-border bg-surface px-4 text-sm text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none"
				/>
				<button className="cta cta-secondary !h-10 !px-4 text-sm" onClick={checkUpdates}>
					<i className="bi bi-arrow-repeat" aria-hidden="true" /> Updates
				</button>
			</div>

			{error ? (
				<ErrorState error={error} onRetry={() => load(true)} />
			) : installs === null ? (
				<div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4" role="status" aria-label="Bibliothek wird geladen">
					{Array.from({ length: 8 }).map((_, i) => (
						<GameCardSkeleton key={i} />
					))}
				</div>
			) : items.length === 0 ? (
				<ErrorState
					variant="empty"
					icon="bi-controller"
					title="Noch nichts installiert"
					message="Entdecke Spiele im Store und installiere sie mit einem Klick."
					action={{ label: "Zum Store", to: "/store" }}
				/>
			) : (
				<motion.div
					className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4"
					variants={items.length <= STAGGER_CAP ? staggerContainer : undefined}
					initial="initial"
					animate="animate"
				>
					{items.map((item, i) => (
						<GameContextMenu key={item.name || item.title || i} item={item} onChanged={load}>
						<motion.article
							variants={items.length <= STAGGER_CAP ? staggerItem : undefined}
							whileHover={hoverLift}
							className="hud-frame flex flex-col overflow-hidden transition-[border-color,box-shadow] duration-200 hover:border-border-strong hover:shadow-[var(--elevation)]"
						>
							<div className="relative aspect-video w-full overflow-hidden bg-bg-2">
								<CoverImage
									src={`/api/library/img/${encodeURIComponent(item.name)}?installationPath=${encodeURIComponent(item.installationPath || "")}`}
									alt={item.title || item.name}
									className="absolute inset-0 h-full w-full object-cover"
								/>
							</div>
							<div className="flex flex-1 flex-col gap-1 p-3.5">
								<span className="text-[10px] font-extrabold uppercase tracking-widest text-neon-green">Spiel</span>
								<span className="truncate font-display text-base font-extrabold text-text-primary">{item.title || item.name}</span>
								<span className="text-xs font-semibold text-text-muted">{item.version ? `v${item.version}` : ""}</span>
								<div className="mt-auto flex items-center justify-between gap-2 pt-3">
									<button
										className={`cta cta-primary !px-4 !py-2 text-sm${launchingName === item.name ? " cta-launching" : ""}`}
										onClick={(e) => play(item, e)}
									>
										<i className="bi bi-play-fill" aria-hidden="true" /> Spielen
									</button>
									<span className="flex gap-1">
										<button onClick={() => openFolder(item)} aria-label="Ordner öffnen" title="Ordner öffnen" className="grid size-9 cursor-pointer place-items-center rounded text-text-secondary transition-colors duration-200 hover:bg-accent hover:text-neon-green">
											<i className="bi bi-folder2-open" aria-hidden="true" />
										</button>
										<button onClick={() => remove(item, load)} aria-label="Deinstallieren" title="Deinstallieren" className="grid size-9 cursor-pointer place-items-center rounded text-text-secondary transition-colors duration-200 hover:bg-error/15 hover:text-error">
											<i className="bi bi-trash" aria-hidden="true" />
										</button>
									</span>
								</div>
							</div>
						</motion.article>
						</GameContextMenu>
					))}
				</motion.div>
			)}
		</div>
	)
}
