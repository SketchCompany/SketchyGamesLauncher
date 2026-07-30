import { useEffect, useRef, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { get } from "../lib/api.js"
import { useStore } from "../lib/store.jsx"
import GameReviews from "../components/store/GameReviews.jsx"
import ErrorState from "../components/ErrorState.jsx"
import { ReviewsSkeleton } from "../components/Skeletons.jsx"
import { minSettle } from "../lib/minDelay.js"

const PAGE = 20

/**
 * Alle Rezensionen zu einem Spiel — paginiert (offset/limit) mit „Mehr laden". Die eigene
 * Rezension wird immer zuerst gepinnt; die Zusammenfassung nutzt die vollen Server-Zähler.
 */
export default function Reviews() {
	const { id } = useParams()
	const navigate = useNavigate()
	const { data: store } = useStore()
	const game = store?.games?.find(g => String(g.id) === id)

	const [mine, setMine] = useState(null)
	const [items, setItems] = useState(undefined) // undefined = Erstladen
	const [counts, setCounts] = useState({ total: 0, positive: 0, negative: 0, percent: 0, label: null })
	const [othersTotal, setOthersTotal] = useState(0)
	const [loadingMore, setLoadingMore] = useState(false)
	const [error, setError] = useState(null)
	const [reloadKey, setReloadKey] = useState(0)
	const retryRef = useRef(false) // markiert einen „Erneut versuchen"-Reload (Skeleton mind. 1s)

	useEffect(() => {
		let alive = true
		const retry = retryRef.current
		retryRef.current = false
		setItems(undefined)
		setError(null)
		const settle = minSettle(retry)
		get(`/api/store/${encodeURIComponent(id)}/reviews?offset=0&limit=${PAGE}`)
			.then(d => settle(() => {
				if (!alive) return
				setMine(d?.mine || null)
				setItems(Array.isArray(d?.items) ? d.items : [])
				setCounts({ total: d?.total || 0, positive: d?.positive || 0, negative: d?.negative || 0, percent: d?.percent ?? 0, label: d?.label ?? null })
				setOthersTotal(d?.othersTotal || 0)
			}))
			.catch(e => settle(() => { if (alive) setError(e) }))
		return () => { alive = false }
	}, [id, reloadKey])

	function loadMore() {
		if (loadingMore) return
		setLoadingMore(true)
		get(`/api/store/${encodeURIComponent(id)}/reviews?offset=${(items || []).length}&limit=${PAGE}`)
			.then(d => {
				setItems(prev => [...(prev || []), ...(Array.isArray(d?.items) ? d.items : [])])
				setOthersTotal(d?.othersTotal ?? othersTotal)
			})
			.catch(() => {})
			.finally(() => setLoadingMore(false))
	}

	const loaded = items || []
	const hasMore = loaded.length < othersTotal

	return (
		<div className="page game-detail">
			<button type="button" className="studio-back" onClick={() => navigate(-1)}>
				<span className="bi bi-arrow-left" aria-hidden="true" /> Zurück
			</button>
			<section className="game-detail__section game-reviews">
				<h2 className="section-title">
					<span className="bi bi-chat-square-quote" aria-hidden="true" /> {game ? `Rezensionen zu ${game.title}` : "Rezensionen"}
				</h2>
				{error ? (
					<ErrorState error={error} onRetry={() => { retryRef.current = true; setReloadKey(k => k + 1) }} />
				) : items === undefined ? (
					<ReviewsSkeleton />
				) : (
					<GameReviews
						mine={mine}
						reviews={loaded}
						total={counts.total}
						positive={counts.positive}
						negative={counts.negative}
						percent={counts.percent}
						label={counts.label}
						comingSoon={false}
						showFilter
						footer={
							hasMore ? (
								<button type="button" className="cta cta-secondary game-reviews__more" onClick={loadMore} disabled={loadingMore}>
									{loadingMore ? "Lädt…" : "Mehr laden"}
								</button>
							) : null
						}
					/>
				)}
			</section>
		</div>
	)
}
