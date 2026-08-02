import { useMemo, useState } from "react"

/**
 * Rezensionen (Empfehlung + Text) mit Statistik. Wird auf der Produktseite (Stichprobe, ohne Filter)
 * UND auf der Rezensionen-Seite (paginiert, mit Filter) genutzt. `mine` wird immer zuerst gepinnt.
 * Zähler (total/positive/negative) kommen vom Server; fehlen sie, werden sie aus der Liste abgeleitet.
 */

function formatDate(iso) {
	const d = new Date(iso)
	if (Number.isNaN(d.getTime())) return iso
	return d.toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" })
}

// Fallback, wenn der Server kein `label` mitschickt (ältere API oder rein lokal abgeleitete Zähler).
// Die Schwellen müssen mit api/storeUtils.js sentimentLabel übereinstimmen — wer eine ändert,
// muss beide Stellen anfassen.
function sentimentLabel(pct, count) {
	if (count === 0) return "Noch keine Wertung"
	if (pct >= 95) return "Äußerst positiv"
	if (pct >= 80) return "Sehr positiv"
	if (pct >= 70) return "Größtenteils positiv"
	if (pct >= 40) return "Gemischt"
	if (pct >= 20) return "Größtenteils negativ"
	return "Überwiegend negativ"
}

function ReviewCard({ r, onEdit }) {
	return (
		<li className={`review-card hud-frame${r.recommended ? " review-card--up" : " review-card--down"}${r.mine ? " review-card--own" : ""}`}>
			<div className="review-card__head">
				<span className={`review-card__verdict ${r.recommended ? "is-up" : "is-down"}`}>
					<span className={`bi ${r.recommended ? "bi-hand-thumbs-up-fill" : "bi-hand-thumbs-down-fill"}`} aria-hidden="true" />
					{r.recommended ? "Empfohlen" : "Nicht empfohlen"}
				</span>
				{r.mine && <span className="review-card__own-badge">Deine Rezension</span>}
				<span className="review-card__author">{r.author}</span>
			</div>
			{/*
			 * Übernommene Sternbewertungen (api/scripts/import-star-ratings.ts) tragen keinen selbst
			 * geschriebenen Text, sondern einen Platzhalter. Sie zählen in der Statistik mit, werden hier
			 * aber als Herkunftshinweis dargestellt — sonst stünde auf jeder dieser Karten derselbe Satz,
			 * als hätte ihn jemand verfasst. Dieselbe Darstellung wie in der Web-App (game-reviews.tsx).
			 */}
			{r.imported ? (
				<p className="review-card__text review-card__text--imported">
					<span className="bi bi-clock-history" aria-hidden="true" /> Übernommen aus einer früheren Sternbewertung — ohne eigenen Text.
				</p>
			) : (
				<p className="review-card__text">{r.text}</p>
			)}
			<div className="review-card__foot">
				{typeof r.hoursPlayed === "number" && <span>{r.hoursPlayed} Std. gespielt</span>}
				<span>{formatDate(r.date)}</span>
				{r.mine && onEdit && (
					<button type="button" className="review-card__edit" onClick={onEdit}>
						<span className="bi bi-pencil" aria-hidden="true" /> Text bearbeiten
					</button>
				)}
			</div>
		</li>
	)
}

export default function GameReviews({ mine = null, reviews = [], total, positive, negative, percent, label, comingSoon, showFilter = true, onEditOwn, footer = null }) {
	const [filter, setFilter] = useState("all")
	const combined = useMemo(() => (mine ? [mine, ...reviews] : reviews), [mine, reviews])

	const stats = useMemo(() => {
		const t = typeof total === "number" ? total : combined.length
		const pos = typeof positive === "number" ? positive : combined.filter(r => r.recommended).length
		const neg = typeof negative === "number" ? negative : t - pos
		// Prozent und Label bevorzugt vom Server (er kennt ALLE Rezensionen, die Liste hier ist
		// nur eine Seite bzw. Stichprobe); sonst aus den vorliegenden Zeilen ableiten.
		const pct = typeof percent === "number" ? percent : t > 0 ? Math.round((pos / t) * 100) : 0
		const withHours = combined.filter(r => typeof r.hoursPlayed === "number")
		const avgHours = withHours.length ? Math.round(withHours.reduce((s, r) => s + (r.hoursPlayed ?? 0), 0) / withHours.length) : 0
		return { total: t, positive: pos, negative: neg, pct, avgHours, label: label || sentimentLabel(pct, t) }
	}, [combined, total, positive, negative, percent, label])

	if (stats.total === 0 && !mine) {
		return (
			<div className="game-reviews__empty hud-frame">
				<span className="bi bi-chat-square-dots" aria-hidden="true" />
				<p>{comingSoon ? "Dieses Spiel ist noch nicht erschienen. Rezensionen folgen nach dem Release." : "Noch keine Rezensionen. Sei der oder die Erste nach dem Spielen!"}</p>
			</div>
		)
	}

	const posPct = stats.pct
	const negPct = 100 - posPct
	const visible = filter === "up" ? combined.filter(r => r.recommended) : filter === "down" ? combined.filter(r => !r.recommended) : combined

	return (
		<div className="game-reviews__inner">
			<div className="game-reviews__summary hud-frame">
				<div className="game-reviews__score">
					<span className="game-reviews__score-pct">{stats.pct}%</span>
					<span className="game-reviews__score-label">{stats.label}</span>
				</div>
				<div className="game-reviews__breakdown">
					<div className="game-reviews__bar" role="img" aria-label={`${posPct}% empfehlen, ${negPct}% nicht`}>
						<span className="game-reviews__bar-up" style={{ width: `${posPct}%` }} />
						<span className="game-reviews__bar-down" style={{ width: `${negPct}%` }} />
					</div>
					<ul className="game-reviews__figures">
						<li>
							<span className="bi bi-chat-square-quote" aria-hidden="true" /> {stats.total} {stats.total === 1 ? "Rezension" : "Rezensionen"}
						</li>
						<li className="is-up">
							<span className="bi bi-hand-thumbs-up-fill" aria-hidden="true" /> {stats.positive} empfehlen
						</li>
						<li className="is-down">
							<span className="bi bi-hand-thumbs-down-fill" aria-hidden="true" /> {stats.negative} nicht
						</li>
						{stats.avgHours > 0 && (
							<li>
								<span className="bi bi-clock-history" aria-hidden="true" /> Ø {stats.avgHours} Std. gespielt
							</li>
						)}
					</ul>
				</div>
			</div>

			{showFilter && (
				<div className="game-reviews__filters" role="tablist" aria-label="Rezensionen filtern">
					<button type="button" role="tab" aria-selected={filter === "all"} className={`game-reviews__filter${filter === "all" ? " active" : ""}`} onClick={() => setFilter("all")}>
						Alle ({stats.total})
					</button>
					<button type="button" role="tab" aria-selected={filter === "up"} className={`game-reviews__filter is-up${filter === "up" ? " active" : ""}`} onClick={() => setFilter("up")}>
						<span className="bi bi-hand-thumbs-up" aria-hidden="true" /> Empfohlen ({stats.positive})
					</button>
					<button type="button" role="tab" aria-selected={filter === "down"} className={`game-reviews__filter is-down${filter === "down" ? " active" : ""}`} onClick={() => setFilter("down")}>
						<span className="bi bi-hand-thumbs-down" aria-hidden="true" /> Nicht empfohlen ({stats.negative})
					</button>
				</div>
			)}

			{visible.length > 0 ? (
				<ul className="game-reviews__list">
					{visible.map((r, i) => (
						<ReviewCard key={`${r.mine ? "mine" : r.author}-${i}`} r={r} onEdit={r.mine ? onEditOwn : undefined} />
					))}
				</ul>
			) : (
				<p className="game-reviews__none">Keine Rezensionen in dieser Auswahl.</p>
			)}

			{footer}
		</div>
	)
}
