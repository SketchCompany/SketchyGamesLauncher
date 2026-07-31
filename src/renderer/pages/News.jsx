import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { motion } from "framer-motion"
import { get } from "../lib/api.js"
import { minSettle } from "../lib/minDelay.js"
import { staggerContainer, staggerItem } from "../lib/motion.js"
import { NewsListSkeleton, PanelSkeleton } from "../components/Skeletons.jsx"
import ErrorState from "../components/ErrorState.jsx"
import BackButton from "../components/BackButton.jsx"
import NewsCard from "../components/news/NewsCard.jsx"
import { relativeTime } from "../components/news/newsKinds.js"

const PAGE_SIZE = 20

/** Vollständige Neuigkeiten-Liste mit „Mehr laden" über den `before`-Cursor der API. */
export default function News() {
	const [items, setItems] = useState(null)
	const [error, setError] = useState(null)
	const [done, setDone] = useState(false)      // keine weiteren Seiten mehr
	const [loadingMore, setLoadingMore] = useState(false)

	function load(retry = false) {
		setError(null)
		setItems(null)
		setDone(false)
		const settle = minSettle(retry)
		get(`/api/news?limit=${PAGE_SIZE}`)
			.then(d => settle(() => {
				const list = Array.isArray(d) ? d : []
				setItems(list)
				setDone(list.length < PAGE_SIZE)
			}))
			.catch(e => settle(() => setError(e)))
	}
	useEffect(() => load(false), [])

	async function loadMore() {
		if (!items || !items.length || loadingMore) return
		setLoadingMore(true)
		try {
			const before = items[items.length - 1].publishedAt
			const next = await get(`/api/news?limit=${PAGE_SIZE}&before=${encodeURIComponent(before)}`)
			const list = Array.isArray(next) ? next : []
			setItems(prev => [...prev, ...list])
			if (list.length < PAGE_SIZE) setDone(true)
		} catch {
			// Nachladen ist ein Extra — der bereits sichtbare Verlauf bleibt stehen.
			setDone(true)
		} finally {
			setLoadingMore(false)
		}
	}

	return (
		<div className="page">
			<div className="mb-6 flex items-center gap-3">
				<BackButton />
				<h2 className="section-title">
					<span className="bi bi-broadcast" aria-hidden="true" /> Neuigkeiten
				</h2>
			</div>

			{error ? (
				<ErrorState error={error} onRetry={() => load(true)} />
			) : items === null ? (
				<NewsListSkeleton count={6} />
			) : items.length === 0 ? (
				<ErrorState
					variant="empty"
					icon="bi-broadcast"
					title="Noch nichts Neues"
					message="Sobald es Updates zu deinen Spielen oder Ankündigungen gibt, stehen sie hier."
					action={{ label: "Zum Store", to: "/store" }}
				/>
			) : (
				<>
					<motion.div className="grid gap-3 md:grid-cols-2" variants={staggerContainer} initial="initial" animate="animate">
						{items.map(item => (
							<motion.div key={`${item.kind}-${item.id}`} variants={staggerItem}>
								<NewsCard item={item} className="h-full" />
							</motion.div>
						))}
					</motion.div>
					{!done && (
						<div className="mt-6 flex justify-center">
							<button className="cta cta-secondary" onClick={loadMore} disabled={loadingMore}>
								{loadingMore ? "Lädt…" : "Mehr laden"}
							</button>
						</div>
					)}
				</>
			)}
		</div>
	)
}

/**
 * Versionshinweise einer einzelnen Version — Ziel der Update- und Launcher-Karten.
 * `/news/launcher/:version` bzw. `/news/game/:gameId/:version`.
 */
export function ReleaseNotes() {
	const { gameId, version } = useParams()
	const target = gameId ? "game" : "launcher"
	const [notes, setNotes] = useState(null)
	const [error, setError] = useState(null)

	function load(retry = false) {
		setError(null)
		setNotes(null)
		const settle = minSettle(retry)
		const params = new URLSearchParams({ target, version: version || "" })
		if (gameId) params.set("targetId", gameId)
		get(`/api/release-notes?${params.toString()}`)
			.then(d => settle(() => setNotes(Array.isArray(d) ? d : [])))
			.catch(e => settle(() => setError(e)))
	}
	useEffect(() => load(false), [gameId, version])

	const note = notes && notes[0]

	return (
		<div className="page">
			<div className="mb-6 flex items-center gap-3">
				<BackButton />
				<h2 className="section-title">
					<span className="bi bi-file-earmark-text" aria-hidden="true" />{" "}
					{target === "launcher" ? "Launcher" : "Patch Notes"} {version && <span className="font-mono text-base text-text-muted">v{version}</span>}
				</h2>
			</div>

			{error ? (
				<ErrorState error={error} onRetry={() => load(true)} />
			) : notes === null ? (
				<PanelSkeleton rows={5} />
			) : !note ? (
				<ErrorState
					variant="empty"
					icon="bi-file-earmark-text"
					title="Keine Versionshinweise"
					message="Zu dieser Version wurde nichts veröffentlicht."
				/>
			) : (
				<article className="hud-frame p-5">
					<h3 className="m-0 font-display text-xl font-extrabold text-text-primary">{note.title || `Version ${note.version}`}</h3>
					<p className="m-0 mt-1 text-xs text-text-muted">
						<time dateTime={note.published_at}>{relativeTime(note.published_at)}</time>
					</p>
					{/* Bewusst als Klartext mit erhaltenen Umbrüchen — kein HTML aus der API rendern. */}
					<p className="mt-4 mb-0 whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">{note.body}</p>
				</article>
			)}
		</div>
	)
}
