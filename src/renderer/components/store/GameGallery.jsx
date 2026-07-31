import { useEffect, useState } from "react"
import CoverImage from "../CoverImage.jsx"

/** Anzeigedauer pro Bild im Auto-Karussell (ms). Videos rotieren stattdessen nach `ended`. */
const IMAGE_DURATION = 7500

/**
 * Galerie der Spielseite (Port aus der Web-App): großer 16:9-Viewport plus Thumbnail-Leiste.
 * Bilder rotieren per Timer, Videos schalten nach dem Abspielen weiter; bei
 * prefers-reduced-motion nur manuelle Navigation.
 */
export default function GameGallery({ title, media }) {
	const [active, setActive] = useState(0)
	const [reduced, setReduced] = useState(false)

	const count = media.length
	const index = count > 0 ? Math.min(active, count - 1) : 0
	const current = media[index]
	const go = dir => setActive(i => (i + dir + count) % count)

	useEffect(() => {
		const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
		const update = () => setReduced(mq.matches)
		update()
		mq.addEventListener("change", update)
		return () => mq.removeEventListener("change", update)
	}, [])

	useEffect(() => {
		if (reduced || count < 2 || current?.type !== "image") return
		const id = window.setTimeout(() => setActive(i => (i + 1) % count), IMAGE_DURATION)
		return () => window.clearTimeout(id)
	}, [reduced, count, index, current?.type])

	if (count === 0) return null

	return (
		<section className="game-gallery" aria-label={`Medien zu ${title}`}>
			<div className="game-gallery__stage">
				{count > 1 && (
					<button type="button" className="game-gallery__arrow game-gallery__arrow--left" onClick={() => go(-1)} aria-label="Vorheriges Medium">
						<span className="bi bi-chevron-left" />
					</button>
				)}
				<div className="game-gallery__frame">
					{current.type === "video" ? (
						<video
							key={current.src}
							className="game-gallery__video"
							src={current.src}
							poster={current.poster}
							controls
							playsInline
							muted={!reduced}
							autoPlay={!reduced}
							preload="metadata"
							onEnded={() => count > 1 && go(1)}
						/>
					) : (
						<CoverImage key={current.src} src={current.src} alt={`${title} – Bild ${index + 1}`} loading="eager" className="absolute inset-0 h-full w-full object-cover" />
					)}
					{count > 1 && (
						<span className="game-gallery__counter">
							{index + 1} / {count}
						</span>
					)}
					{current.type === "image" && count > 1 && !reduced && (
						<div className="game-gallery__progress" aria-hidden="true">
							<div className="game-gallery__progress-fill" key={index} style={{ animationDuration: `${IMAGE_DURATION}ms` }} />
						</div>
					)}
				</div>
				{count > 1 && (
					<button type="button" className="game-gallery__arrow game-gallery__arrow--right" onClick={() => go(1)} aria-label="Nächstes Medium">
						<span className="bi bi-chevron-right" />
					</button>
				)}
			</div>

			{count > 1 && (
				<div className="game-gallery__thumbs" role="tablist" aria-label={`Medienauswahl ${title}`}>
					{media.map((item, i) => {
						const poster = item.type === "video" ? item.poster : item.src
						return (
							<button key={`${item.type}-${item.src}`} type="button" role="tab" aria-selected={i === index} className={`game-gallery__thumb${i === index ? " active" : ""}`} onClick={() => setActive(i)}>
								{poster ? (
									<img src={poster} alt={`${title} – Vorschau ${i + 1}`} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
								) : (
									<span className="game-gallery__thumb-ph" aria-hidden="true" />
								)}
								{item.type === "video" && (
									<span className="game-gallery__thumb-badge" aria-hidden="true">
										<span className="bi bi-play-fill" />
									</span>
								)}
							</button>
						)
					})}
				</div>
			)}
		</section>
	)
}
