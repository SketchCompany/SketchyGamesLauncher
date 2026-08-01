import { useRef } from "react"
import { Link } from "react-router-dom"
import StoreCard from "./StoreCard.jsx"

/**
 * Horizontale Spiele-Reihe mit Scroll-Pfeilen (Port aus der Web-App).
 *
 * `reason` ist die Begründung einer personalisierten Reihe („Ähnlich zu X"). Eine Empfehlung ohne
 * nachvollziehbaren Grund kann der Nutzer weder einordnen noch korrigieren.
 */
export default function GameRow({ title, games, icon, moreTo, reason }) {
	const trackRef = useRef(null)

	if (!games || games.length === 0) return null

	function scrollBy(dir) {
		const track = trackRef.current
		if (!track) return
		track.scrollBy({ left: dir * Math.round(track.clientWidth * 0.85), behavior: "smooth" })
	}

	return (
		<section className="game-row">
			<div className="game-row__head">
				<div className="game-row__heading">
					<h2 className="section-title">
						{icon && <span className={`bi ${icon}`} aria-hidden="true" />} {title}
					</h2>
					{reason && <p className="game-row__reason">{reason}</p>}
				</div>
				{moreTo && (
					<Link to={moreTo} className="game-row__more">
						Weitere anzeigen <span className="bi bi-chevron-right" aria-hidden="true" />
					</Link>
				)}
			</div>

			<div className="game-row__viewport">
				<button className="row-nav row-nav--left" onClick={() => scrollBy(-1)} aria-label="Zurück scrollen">
					<span className="bi bi-chevron-left" />
				</button>
				<div className="game-row__track" ref={trackRef}>
					{games.map(game => (
						<div className="game-row__item" key={game.id}>
							<StoreCard game={game} />
						</div>
					))}
				</div>
				<button className="row-nav row-nav--right" onClick={() => scrollBy(1)} aria-label="Weiter scrollen">
					<span className="bi bi-chevron-right" />
				</button>
			</div>
		</section>
	)
}
