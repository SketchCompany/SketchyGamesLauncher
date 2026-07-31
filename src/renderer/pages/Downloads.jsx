import { useEffect, useRef, useState } from "react"
import { get } from "../lib/api.js"
import { Skeleton } from "../components/Skeletons.jsx"
import ErrorState from "../components/ErrorState.jsx"

/** Downloads: lokale Daten → Kopf rendert sofort; die Karte zeigt kurz ein Skeleton bis /api/downloads da ist. */
export default function Downloads() {
	const [queue, setQueue] = useState([])
	const [progress, setProgress] = useState(null)
	const [paused, setPaused] = useState(false)
	const [ready, setReady] = useState(false)
	const [error, setError] = useState(null)
	const timer = useRef(null)

	// Fehler getrennt von „leer" halten: bei Fehlschlag error setzen, bei Erfolg zurücksetzen.
	const loadQueue = () => get("/api/downloads")
		.then(d => { setQueue(d?.downloadQueue || []); setError(null) })
		.catch(e => setError(e))
		.finally(() => setReady(true))

	useEffect(() => {
		loadQueue()
		get("/api/download/state").then(s => setPaused(!!s?.paused)).catch(() => {})
		timer.current = setInterval(async () => {
			try {
				const p = await get("/api/download/progress")
				setProgress(p)
				if (p?.percentage >= 100 || p == null) loadQueue()
			} catch { /* noop */ }
		}, 1000)
		return () => clearInterval(timer.current)
	}, [])

	async function toggle() {
		try {
			if (paused) { await get("/api/download/resume"); setPaused(false) }
			else { await get("/api/download/pause"); setPaused(true) }
		} catch { /* noop */ }
	}
	async function cancel() {
		try { await get("/api/download/cancel"); loadQueue() } catch { /* noop */ }
	}

	const pct = Math.max(0, Math.min(100, Number(progress?.percentage) || 0))
	const active = queue.length > 0

	return (
		<div className="page">
			<h2 className="section-title mb-4">
				<span className="bi bi-download" aria-hidden="true" /> Aktueller Download
			</h2>
			{!ready && !active ? (
				<div className="hud-frame p-5" role="status" aria-label="Downloads werden geladen">
					<div className="mb-3.5 flex items-center justify-between gap-3">
						<div className="flex flex-col gap-2">
							<Skeleton className="h-[1.1em] rounded-md" width="220px" />
							<Skeleton className="h-[0.8em] rounded-md" width="140px" />
						</div>
					</div>
					<Skeleton className="h-2.5 w-full rounded-full" />
				</div>
			) : error && !active ? (
				<ErrorState error={error} onRetry={loadQueue} />
			) : active ? (
				<div className="hud-frame p-5">
					<div className="mb-3.5 flex items-center justify-between gap-3">
						<div>
							<h3 className="m-0 font-display text-lg font-bold text-text-primary">{queue[0].title || queue[0].name}</h3>
							<span className="text-sm text-text-muted">
								{progress?.speed ? `${progress.speed} MB/s · ` : ""}{pct.toFixed(0)} %
								{progress?.time && (progress.time.hours !== 0 || progress.time.minutes !== 0) ? ` · noch ${progress.time.hours}:${progress.time.minutes}:${progress.time.seconds}` : ""}
							</span>
						</div>
						<div className="flex gap-2">
							<button className="cta cta-secondary !px-4 !py-2 text-sm" onClick={toggle}>
								<i className={`bi ${paused ? "bi-play-fill" : "bi-pause-fill"}`} aria-hidden="true" /> {paused ? "Fortsetzen" : "Pausieren"}
							</button>
							<button className="cta cta-danger !px-4 !py-2 text-sm" onClick={cancel}>
								<i className="bi bi-x-lg" aria-hidden="true" /> Abbrechen
							</button>
						</div>
					</div>
					<div className="h-2.5 overflow-hidden rounded-full bg-bg-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
						<span className="block h-full rounded-full bg-neon-green transition-[width] duration-500" style={{ width: `${pct}%` }} />
					</div>
				</div>
			) : (
				<ErrorState
					variant="empty"
					icon="bi-cloud-check"
					title="Keine aktiven Downloads"
					message="Alles auf dem neuesten Stand. Neue Spiele findest du im Store."
					action={{ label: "Zum Store", to: "/store" }}
				/>
			)}

			{active && queue.length > 1 && (
				<>
					<h2 className="section-title mb-4 mt-8">
						<span className="bi bi-list-ol" aria-hidden="true" /> Warteschlange
					</h2>
					<div className="flex flex-col gap-2.5">
						{queue.slice(1).map((q, i) => (
							<div key={i} className="hud-frame flex items-center justify-between px-4 py-3">
								<span className="font-bold text-text-primary">{q.title || q.name}</span>
								<span className="text-sm text-text-muted">{q.version ? `v${q.version}` : ""}</span>
							</div>
						))}
					</div>
				</>
			)}
		</div>
	)
}
