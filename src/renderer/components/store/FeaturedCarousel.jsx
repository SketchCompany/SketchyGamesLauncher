import { useState, useEffect, useCallback, useRef } from "react"
import { Link } from "react-router-dom"
import CoverImage from "../CoverImage.jsx"
import StoreCardPreview from "./StoreCardPreview.jsx"
import { useStorePreview } from "./useStorePreview.js"

/**
 * Steam-artiges Featured-Hero mit Endlos-Karussell + Thumbnail-Leiste (Port aus der
 * Web-App, components/games/featured-carousel.tsx). CTAs führen im Launcher direkt
 * auf die Spielseite (statt zur Launcher-Downloadseite der Website).
 */

function FeaturedThumb({ game, active, showProgress, interval, progressKey, onSelect }) {
	const { ref, anchor, open, triggerProps, previewProps } = useStorePreview()

	return (
		<>
			<button ref={ref} role="tab" aria-selected={active} className={`featured-hero__thumb${active ? " active" : ""}`} onClick={onSelect} {...triggerProps}>
				{game.thumbnail && <img src={game.thumbnail} alt={game.title} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />}
				<span className="featured-hero__thumb-label">{game.title}</span>
				{showProgress && active && <span className="featured-hero__thumb-progress" key={progressKey} style={{ animationDuration: `${interval}ms` }} aria-hidden="true" />}
			</button>
			{anchor && <StoreCardPreview game={game} anchor={anchor} open={open} {...previewProps} />}
		</>
	)
}

// Sicherheits-Timeout zum Lösen des Cooldowns, falls transitionend ausbleibt.
const SAFETY_MS = 900

export default function FeaturedCarousel({ games, autoRotate = true, interval = 7000 }) {
	const count = games.length

	const [reducedMotion, setReducedMotion] = useState(false)
	useEffect(() => {
		const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
		const update = () => setReducedMotion(mq.matches)
		update()
		mq.addEventListener("change", update)
		return () => mq.removeEventListener("change", update)
	}, [])

	const loop = count > 1 && !reducedMotion

	// Endlos-Karussell: Track = [Klon(letztes), …echte Slides…, Klon(erstes)]; Details
	// siehe Web-App-Original — Logik unverändert übernommen.
	const [position, setPosition] = useState(count > 1 ? 1 : 0)
	const [animate, setAnimate] = useState(true)
	const timerRef = useRef(null)
	const cooldownRef = useRef(false)
	const safetyRef = useRef(null)
	const positionRef = useRef(position)
	positionRef.current = position

	const settle = useCallback(() => {
		if (safetyRef.current) {
			clearTimeout(safetyRef.current)
			safetyRef.current = null
		}
		cooldownRef.current = false
		if (!loop) return
		if (positionRef.current === count + 1) {
			setAnimate(false)
			setPosition(1)
		} else if (positionRef.current === 0) {
			setAnimate(false)
			setPosition(count)
		}
	}, [count, loop])

	const lock = useCallback(() => {
		cooldownRef.current = true
		if (safetyRef.current) clearTimeout(safetyRef.current)
		safetyRef.current = setTimeout(settle, SAFETY_MS)
	}, [settle])

	const next = useCallback(() => {
		if (loop) {
			if (cooldownRef.current) return
			lock()
		}
		setPosition(p => (count > 1 && reducedMotion ? (p + 1) % count : p + 1))
	}, [count, reducedMotion, loop, lock])
	const prev = useCallback(() => {
		if (loop) {
			if (cooldownRef.current) return
			lock()
		}
		setPosition(p => (count > 1 && reducedMotion ? (p - 1 + count) % count : p - 1))
	}, [count, reducedMotion, loop, lock])
	const goTo = useCallback(
		i => {
			const target = loop ? i + 1 : i
			if (target === positionRef.current) return
			if (loop) {
				if (cooldownRef.current) return
				lock()
			}
			setPosition(target)
		},
		[loop, lock],
	)

	useEffect(() => {
		cooldownRef.current = false
		if (safetyRef.current) {
			clearTimeout(safetyRef.current)
			safetyRef.current = null
		}
		setPosition(loop ? 1 : 0)
	}, [loop])

	useEffect(
		() => () => {
			if (safetyRef.current) clearTimeout(safetyRef.current)
		},
		[],
	)

	const activeIndex = loop ? (((position - 1) % count) + count) % count : ((position % count) + count) % count

	useEffect(() => {
		if (animate) return
		const id = requestAnimationFrame(() => requestAnimationFrame(() => setAnimate(true)))
		return () => cancelAnimationFrame(id)
	}, [animate])

	useEffect(() => {
		if (!autoRotate || !loop) return
		timerRef.current = setTimeout(next, interval)
		return () => {
			if (timerRef.current) clearTimeout(timerRef.current)
		}
	}, [autoRotate, interval, next, loop, position])

	if (count === 0) return null

	const handleTransitionEnd = e => {
		if (!loop || e.target !== e.currentTarget || e.propertyName !== "transform") return
		settle()
	}

	const slides = loop ? [games[count - 1], ...games, games[0]] : games
	const showProgress = autoRotate && loop

	return (
		<section className="featured-hero" aria-roledescription="Karussell">
			<div className="featured-hero__main">
				<div className="featured-hero__viewport">
					<div className="featured-hero__track" style={{ transform: `translate3d(${-position * 100}%, 0, 0)`, transition: animate ? undefined : "none" }} onTransitionEnd={handleTransitionEnd}>
						{slides.map((g, i) => (
							<div className="featured-hero__slide" key={i} aria-hidden={i !== position}>
								{g.thumbnail && <CoverImage src={g.thumbnail} alt={g.title} loading={i <= 1 ? "eager" : "lazy"} className="absolute inset-0 h-full w-full object-cover" />}
								<div className="featured-hero__shade" />
								<div className="featured-hero__caption">
									<p className="featured-hero__eyebrow">
										<span className="bi bi-stars" aria-hidden="true" /> Empfohlen · {g.category}
									</p>
									<h2 className="featured-hero__title">
										<Link to={`/store/${encodeURIComponent(g.id)}`} state={{ product: g }} className="featured-hero__title-link" tabIndex={i === position ? 0 : -1}>
											{g.title}
										</Link>
									</h2>
									{g.tagline && <p className="featured-hero__tagline">{g.tagline}</p>}
									{g.tags && (
										<div className="featured-hero__tags">
											{g.tags.slice(0, 4).map(tag => (
												<span key={tag} className="store-tag">
													{tag}
												</span>
											))}
										</div>
									)}
									<div className="featured-hero__actions">
										{g.comingSoon ? <span className="badge badge--soon">Bald verfügbar</span> : <span className="badge badge--free">Gratis</span>}
										<Link to={`/store/${encodeURIComponent(g.id)}`} state={{ product: g }} className="cta cta-primary featured-hero__cta" tabIndex={i === position ? 0 : -1}>
											<span className="bi bi-controller" aria-hidden="true" /> Spiel ansehen
										</Link>
									</div>
								</div>
							</div>
						))}
					</div>
					{showProgress && (
						<div className="featured-hero__progress" aria-hidden="true">
							<div className="featured-hero__progress-fill" key={activeIndex} style={{ animationDuration: `${interval}ms` }} />
						</div>
					)}
				</div>

				<button className="featured-hero__arrow featured-hero__arrow--left" onClick={prev} aria-label="Vorheriges Spiel">
					<span className="bi bi-chevron-left" />
				</button>
				<button className="featured-hero__arrow featured-hero__arrow--right" onClick={next} aria-label="Nächstes Spiel">
					<span className="bi bi-chevron-right" />
				</button>
			</div>

			<div className="featured-hero__rail" role="tablist" aria-label="Empfohlene Spiele">
				{games.map((g, i) => (
					<FeaturedThumb key={g.id} game={g} active={i === activeIndex} showProgress={showProgress} interval={interval} progressKey={activeIndex} onSelect={() => goTo(i)} />
				))}
			</div>
		</section>
	)
}
