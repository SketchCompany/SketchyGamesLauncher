import { useEffect, useMemo, useState } from "react"
import { Link, useLocation, useNavigate, useParams } from "react-router-dom"
import { get, send } from "../lib/api.js"
import { useStore } from "../lib/store.jsx"
import { useNotify } from "../lib/notifications.jsx"
import { useGameActions } from "../lib/gameActions.jsx"
import GameGallery from "../components/store/GameGallery.jsx"
import GameReviews from "../components/store/GameReviews.jsx"
import ReviewForm from "../components/store/ReviewForm.jsx"
import GameRow from "../components/store/GameRow.jsx"
import WishlistButton from "../components/store/WishlistButton.jsx"
import CoverImage from "../components/CoverImage.jsx"
import ErrorState from "../components/ErrorState.jsx"
import { GameDetailSkeleton, ReviewsSkeleton } from "../components/Skeletons.jsx"
import { platformName } from "../components/common.jsx"
import { effectivePrice, formatPrice } from "../components/store/gameUi.js"

// Stabile leere Referenz, damit der Fallback-Effekt bei leerem Katalog nicht endlos feuert.
const EMPTY_GAMES = []
const EMPTY_OVERVIEW = { mine: null, total: 0, positive: 0, negative: 0, sample: { up: [], down: [] } }
const PLAYTIME_GATE_SEC = 15 * 60 // 15 Minuten Spielzeit bis zur ersten Rezension

/** `**fett**` / `*kursiv*` sicher in <strong>/<em> umsetzen (Port aus der Web-App). */
function renderItalic(text, keyPrefix) {
	return text.split(/\*(.+?)\*/g).map((part, i) => (i % 2 === 1 ? <em key={`${keyPrefix}i${i}`}>{part}</em> : part))
}
function renderInline(text, keyPrefix = "") {
	const out = []
	text.split(/\*\*(.+?)\*\*/g).forEach((part, i) => {
		if (i % 2 === 1) out.push(<strong key={`${keyPrefix}b${i}`}>{renderItalic(part, `${keyPrefix}b${i}`)}</strong>)
		else out.push(...renderItalic(part, `${keyPrefix}t${i}`))
	})
	return out
}

function formatDateLong(iso) {
	if (!iso) return ""
	const d = new Date(iso)
	if (Number.isNaN(d.getTime())) return ""
	return d.toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" })
}

const REQ_ROWS = [
	{ key: "os", label: "Betriebssystem" },
	{ key: "cpu", label: "Prozessor" },
	{ key: "ram", label: "Arbeitsspeicher" },
	{ key: "gpu", label: "Grafik" },
	{ key: "storage", label: "Speicherplatz" },
]

/** Ähnliche Spiele: gleiche Kategorie + Tag-Überschneidung, sonst Beliebtheit. */
function pickSimilar(game, all, limit = 8) {
	const tags = new Set((game.tags ?? []).map(t => t.toLowerCase()))
	return all
		.filter(g => g.id !== game.id)
		.map(g => {
			let score = 0
			if (g.category === game.category) score += 4
			for (const t of g.tags ?? []) if (tags.has(t.toLowerCase())) score += 1
			return { g, score }
		})
		.sort((a, b) => b.score - a.score || (b.g.downloads ?? 0) - (a.g.downloads ?? 0))
		.slice(0, limit)
		.map(x => x.g)
}

/**
 * Spiel-Detailseite — Layout-Port der Web-App (app/games/[id]): Galerie, Sticky-Leiste,
 * Overview, „Über das Spiel“, Systemanforderungen, Rezensionen (inkl. Sterne-Abgabe)
 * und ähnliche Spiele. Der Kauf-/Lade-Knopf nutzt die Launcher-Download-Pipeline.
 */
export default function Product() {
	const { product: param } = useParams()
	const { state } = useLocation()
	const navigate = useNavigate()
	const notify = useNotify()
	const { play, launchingName } = useGameActions()
	const [product, setProduct] = useState(state?.product || null)
	const [missing, setMissing] = useState(false)
	const [busy, setBusy] = useState(false)
	const [overview, setOverview] = useState(undefined) // { mine, total, positive, negative, sample } | undefined = lädt
	const [overviewError, setOverviewError] = useState(null)
	const [playtimeSec, setPlaytimeSec] = useState(0)   // lokale Spielzeit (15-Min-Gate)
	const [editingReview, setEditingReview] = useState(false)
	const [installed, setInstalled] = useState(null) // lokaler Install-Datensatz (falls installiert)
	const [updatePending, setUpdatePending] = useState(false) // Update verfügbar (updatesFile)

	// Aus dem geteilten Store-Cache: Fallback fürs Produkt (Direktaufruf) + „Ähnliche Spiele“.
	const { data: store, error: storeError, refresh } = useStore()
	const allGames = store ? (Array.isArray(store.games) ? store.games : EMPTY_GAMES) : null

	useEffect(() => {
		// Store-Ladefehler NICHT als „nicht gefunden“ behandeln — den behandelt der storeError-Zweig
		// im Render (mit richtiger Ursache). „missing“ nur, wenn der Katalog da ist und die id fehlt.
		if (!allGames) return
		const found = allGames.find(p => String(p.id) === param)
		if (found) setProduct(prev => (prev && prev.hasBuild !== undefined ? prev : found))
		else if (!state?.product) setMissing(true)
	}, [allGames, param, state?.product])

	// Ist das Spiel lokal installiert? Dann „Spiel starten“ statt „Herunterladen“ (Join: install.name === Spiel-id).
	// `/api/installs` liefert nur Spiele, die dem angemeldeten Konto gehören — eine Installation
	// eines anderen Kontos zählt hier also bewusst als „nicht installiert“.
	// Parallel: steht für das Spiel ein Update an? Dann gibt es zusätzlich „Aktualisieren“.
	useEffect(() => {
		let alive = true
		get("/api/installs")
			.then(d => { if (alive) setInstalled((Array.isArray(d?.games) ? d.games : []).find(g => String(g.name) === String(param)) || null) })
			.catch(() => { if (alive) setInstalled(null) })
		get("/api/updates")
			.then(d => { if (alive) setUpdatePending((Array.isArray(d?.updates) ? d.updates : []).some(u => String(u.name) === String(param))) })
			.catch(() => { if (alive) setUpdatePending(false) })
		return () => { alive = false }
	}, [param])

	// Rezensionen-Übersicht laden: eigene (gepinnt) + Zähler + zufällige 5/5-Stichprobe.
	function reloadOverview() {
		setOverviewError(null)
		setOverview(undefined)
		get(`/api/store/${encodeURIComponent(param)}/reviews?mode=overview`)
			.then(d => setOverview(d && typeof d === "object" ? d : EMPTY_OVERVIEW))
			.catch(e => setOverviewError(e))
	}
	useEffect(() => {
		let alive = true
		setOverview(undefined)
		setEditingReview(false)
		get(`/api/store/${encodeURIComponent(param)}/reviews?mode=overview`)
			.then(d => { if (alive) setOverview(d && typeof d === "object" ? d : EMPTY_OVERVIEW) })
			.catch(() => { if (alive) setOverview(EMPTY_OVERVIEW) })
		return () => { alive = false }
	}, [param])

	// Lokale Spielzeit fürs 15-Min-Gate (neu laden, wenn sich der Install-Status ändert).
	useEffect(() => {
		let alive = true
		get(`/api/playtime/${encodeURIComponent(param)}`)
			.then(d => { if (alive) setPlaytimeSec(d?.seconds || 0) })
			.catch(() => { if (alive) setPlaytimeSec(0) })
		return () => { alive = false }
	}, [param, installed])

	/**
	 * Holen/Herunterladen. `allowUpdate` unterscheidet die beiden Wege über denselben Endpunkt:
	 * ohne das Flag lädt ein bereits installiertes Spiel NICHT erneut (der Server antwortet
	 * `alreadyInstalled`), mit dem Flag ist es der ausdrückliche Update-Klick.
	 * send() ist bewusst „weich" und wirft nicht bei status:0 — deshalb der rohe Envelope (true)
	 * und die eigene Statusprüfung, sonst meldet auch eine Ablehnung „Download gestartet".
	 */
	async function download(allowUpdate = false) {
		setBusy(true)
		try {
			const res = await send("/api/download", { id: product.id, name: product.id, title: product.title, sha256: product.sha256, version: product.version, thumbnail: product.thumbnail, allowUpdate }, true)
			if (!res || res.status !== 1) {
				notify("Fehler", typeof res?.data === "string" ? res.data : "Download konnte nicht gestartet werden.", "error")
			} else if (res.alreadyInstalled) {
				// Schon installiert: kein neuer Download, direkt in die Bibliothek. Ist die Version
				// veraltet, hat der Server bereits „Update verfügbar" gemeldet — geladen wird erst
				// auf Klick.
				notify("Bereits installiert", res.data, "success")
				if (res.updateAvailable) setUpdatePending(true)
				navigate("/library")
			} else {
				notify("Download gestartet", `${product.title} wird heruntergeladen.`, "success")
			}
		} catch (err) {
			notify("Fehler", "Download konnte nicht gestartet werden: " + err, "error")
		} finally {
			setBusy(false)
		}
	}

	// Installiertes Spiel starten — geteilt mit Bibliothek, Startseite und Kontextmenü
	// (lib/gameActions.jsx), inkl. Start-Overlay.
	function startGame(e) {
		if (!installed) return
		play({ ...installed, title: product.title || installed.title }, e)
	}


	if (missing) {
		return (
			<div className="page">
				<ErrorState
					variant="empty"
					icon="bi-question-circle"
					title="Spiel nicht gefunden"
					message="Dieses Spiel gibt es nicht (mehr) im Store."
					action={{ label: "Zum Store", to: "/store" }}
				/>
			</div>
		)
	}

	// Store konnte nicht geladen werden und wir haben kein mitgegebenes Produkt → echte Ursache zeigen.
	if (storeError && !product) {
		return (
			<div className="page">
				<ErrorState error={storeError} onRetry={refresh} />
			</div>
		)
	}

	if (!product) {
		return (
			<div className="page">
				<GameDetailSkeleton />
			</div>
		)
	}

	const game = product
	const isComingSoon = Boolean(game.comingSoon)
	const lead = game.tagline ?? game.description
	const developer = game.developer || game.developerSlug
	const price = effectivePrice(game)
	// Empfehlungsprozentsatz aus echten Rezensionen; ohne Stimmen der geerbte games.rating-Wert.
	// `label` kommt vom Server (storeUtils.sentimentLabel), damit Store und Web-App dasselbe Wort zeigen.
	const hasVotes = (game.recommendation?.total ?? 0) > 0
	const rating = hasVotes ? game.recommendation.percent : (game.rating ?? 0)
	const ratingLabel = hasVotes ? game.recommendation.label : null

	const galleryMedia =
		Array.isArray(game.media) && game.media.length > 0
			? game.media
			: [
					...(Array.isArray(game.videos) ? game.videos : []).map(v => ({ type: "video", src: v.src, poster: v.poster })),
					...Array.from(new Set([game.thumbnail, ...(game.screenshots ?? [])].filter(Boolean))).map(src => ({ type: "image", src })),
				]

	const minimum = game.requirements?.minimum
	const recommended = game.requirements?.recommended
	const hasRequirements = Boolean(minimum || recommended)
	const similar = allGames ? pickSimilar(game, allGames) : []

	// Download-CTA im Launcher: echter Install-Knopf statt „Im Launcher öffnen“.
	// „Spiel starten“ nur, wenn das Spiel installiert ist UND dem Konto gehört. `installed` kommt
	// schon lizenzgefiltert vom Server; `game.owned !== false` fängt zusätzlich den Fall ab, dass
	// der Server den Besitz ausdrücklich verneint (z.B. widerrufene Lizenz, Cache noch alt) —
	// `undefined` (kein Store-Datensatz) darf den Start dagegen NICHT blockieren.
	const canPlay = installed && game.owned !== false
	const cta = isComingSoon ? (
		<button type="button" className="cta cta-secondary game-detail__cta" disabled>
			<span className="bi bi-hourglass-split" aria-hidden="true" /> Demnächst
		</button>
	) : canPlay ? (
		<>
			<button
				type="button"
				className={`cta cta-primary game-detail__cta${launchingName === installed.name ? " cta-launching" : ""}`}
				onClick={startGame}
			>
				<span className="bi bi-play-fill" aria-hidden="true" /> Spiel starten
			</button>
			{updatePending && (
				// Der einzige Weg, der ein installiertes Spiel erneut lädt (allowUpdate) — genau
				// hierhin führt auch die „Update verfügbar“-Benachrichtigung.
				<button type="button" className="cta cta-secondary game-detail__cta" onClick={() => download(true)} disabled={busy}>
					<span className="bi bi-arrow-repeat" aria-hidden="true" /> {busy ? "Startet…" : "Aktualisieren"}
				</button>
			)}
		</>
	) : game.hasBuild ? (
		<button type="button" className="cta cta-primary game-detail__cta" onClick={() => download(false)} disabled={busy}>
			<span className="bi bi-download" aria-hidden="true" /> {busy ? "Startet…" : game.owned ? "Herunterladen" : price > 0 ? "Kaufen & laden" : "Kostenlos laden"}
		</button>
	) : (
		<button type="button" className="cta cta-secondary game-detail__cta" disabled>
			<span className="bi bi-slash-circle" aria-hidden="true" /> Nicht verfügbar für {platformName()}
		</button>
	)

	return (
		<div className="page game-detail">
			{galleryMedia.length > 0 && <GameGallery title={game.title} media={galleryMedia} />}

			<header className="game-detail__bar">
				<div className="game-detail__bar-info">
					<h1 className="game-detail__title">{game.title}</h1>
					<p className="game-detail__bar-sub">
						<Link to={`/search?kategorie=${encodeURIComponent(game.category ?? "")}`} className="game-detail__cat">
							{game.category}
						</Link>
						{developer && (
							<span className="game-detail__by">
								von{" "}
								{game.developerSlug ? (
									<Link to={`/studio/${encodeURIComponent(game.developerSlug)}`}><strong>{developer}</strong></Link>
								) : (
									<strong>{developer}</strong>
								)}
							</span>
						)}
					</p>
				</div>
				<div className="game-detail__bar-buy">
					<span className="game-detail__price">{price > 0 ? formatPrice(price) : "Kostenlos"}</span>
					<WishlistButton gameId={game.id} variant="pill" />
					{cta}
				</div>
			</header>

			<section className="game-detail__overview">
				{lead && <p className="game-detail__lead">{lead}</p>}

				{game.tags && game.tags.length > 0 && (
					<div className="game-detail__tags">
						{game.tags.map(tag => (
							<Link key={tag} to={`/search?tags=${encodeURIComponent(tag)}`} className="store-tag">
								{tag}
							</Link>
						))}
					</div>
				)}

				<dl className="game-detail__stats">
					{developer && (
						<div className="game-stat game-stat--dev">
							<dt>
								<span className="bi bi-building" aria-hidden="true" /> Entwickler
							</dt>
							<dd>{game.developerSlug ? <Link to={`/studio/${encodeURIComponent(game.developerSlug)}`}>{developer}</Link> : developer}</dd>
						</div>
					)}
					{game.releaseDate && (
						<div className="game-stat">
							<dt>
								<span className="bi bi-calendar-event" aria-hidden="true" /> {isComingSoon ? "Geplant" : "Veröffentlichung"}
							</dt>
							<dd>{formatDateLong(game.releaseDate)}</dd>
						</div>
					)}
					{(game.downloads ?? 0) > 0 && (
						<div className="game-stat">
							<dt>
								<span className="bi bi-download" aria-hidden="true" /> Downloads
							</dt>
							<dd>{game.downloads.toLocaleString("de-DE")}</dd>
						</div>
					)}
					{rating > 0 && (
						<div className="game-stat">
							<dt>
								<span className="bi bi-hand-thumbs-up" aria-hidden="true" /> Bewertung
							</dt>
							<dd>
								{rating}% positiv
								{ratingLabel && <span className="game-stat__note"> · {ratingLabel}</span>}
							</dd>
						</div>
					)}
				</dl>
			</section>

			{Array.isArray(game.about) && game.about.length > 0 && (
				<section className="game-detail__section game-about">
					<h2 className="section-title">
						<span className="bi bi-card-text" aria-hidden="true" /> Über das Spiel
					</h2>
					<div className="game-about__body">
						{game.about.map((block, i) => {
							if (block.type === "heading") return <h3 key={i} className="game-about__heading">{renderInline(block.text, `h${i}`)}</h3>
							if (block.type === "paragraph") return <p key={i} className="game-about__paragraph">{renderInline(block.text, `p${i}`)}</p>
							if (block.type === "list") {
								const ListTag = block.ordered ? "ol" : "ul"
								return (
									<ListTag key={i} className="game-about__list">
										{block.items.map((item, j) => (
											<li key={j}>{renderInline(item, `l${i}-${j}`)}</li>
										))}
									</ListTag>
								)
							}
							return (
								<figure key={i} className="game-about__figure">
									<div className="game-about__image">
										<CoverImage src={block.src} alt={block.caption ?? `${game.title} Bild`} className="absolute inset-0 h-full w-full object-cover" />
									</div>
									{block.caption && <figcaption className="game-about__caption">{block.caption}</figcaption>}
								</figure>
							)
						})}
					</div>
				</section>
			)}

			<div className="convince-cta">
				<p className="convince-cta__lead">Überzeugt? Finde mehr im Spiel heraus.</p>
				{cta}
			</div>

			{hasRequirements && (
				<section className="game-detail__section game-reqs">
					<h2 className="section-title">
						<span className="bi bi-pc-display" aria-hidden="true" /> Systemanforderungen
					</h2>
					<div className="game-reqs__grid">
						{minimum && (
							<div className="game-reqs__col hud-frame">
								<h3 className="game-reqs__col-title">Minimum</h3>
								<dl className="game-reqs__list">
									{REQ_ROWS.filter(row => minimum[row.key]).map(row => (
										<div key={row.key} className="game-reqs__row">
											<dt>{row.label}</dt>
											<dd>{minimum[row.key]}</dd>
										</div>
									))}
								</dl>
							</div>
						)}
						{recommended && (
							<div className="game-reqs__col hud-frame">
								<h3 className="game-reqs__col-title">Empfohlen</h3>
								<dl className="game-reqs__list">
									{REQ_ROWS.filter(row => recommended[row.key]).map(row => (
										<div key={row.key} className="game-reqs__row">
											<dt>{row.label}</dt>
											<dd>{recommended[row.key]}</dd>
										</div>
									))}
								</dl>
							</div>
						)}
					</div>
				</section>
			)}

			<section className="game-detail__section game-reviews">
				<h2 className="section-title">
					<span className="bi bi-chat-square-quote" aria-hidden="true" /> Rezensionen
				</h2>

				{overviewError ? (
					<ErrorState variant="inline" error={overviewError} onRetry={reloadOverview} />
				) : overview === undefined ? (
					<ReviewsSkeleton />
				) : (
					<>
						<GameReviews
							mine={overview.mine}
							reviews={[...(overview.sample?.up || []), ...(overview.sample?.down || [])]}
							total={overview.total}
							positive={overview.positive}
							negative={overview.negative}
							percent={overview.percent}
							label={overview.label}
							comingSoon={isComingSoon}
							showFilter={false}
							onEditOwn={() => setEditingReview(true)}
							footer={
								overview.total > 0 ? (
									<Link className="cta cta-secondary game-reviews__all" to={`/store/${encodeURIComponent(product.id)}/reviews`}>
										<span className="bi bi-chat-square-quote" aria-hidden="true" /> Alle Rezensionen anzeigen
									</Link>
								) : null
							}
						/>

						{editingReview && overview.mine ? (
							<ReviewForm
								gameId={product.id}
								initial={overview.mine}
								hoursPlayed={Math.floor(playtimeSec / 3600)}
								onDone={() => { setEditingReview(false); reloadOverview() }}
								onCancel={() => setEditingReview(false)}
							/>
						) : !overview.mine ? (
							installed && playtimeSec >= PLAYTIME_GATE_SEC ? (
								<ReviewForm gameId={product.id} hoursPlayed={Math.floor(playtimeSec / 3600)} onDone={reloadOverview} />
							) : (
								<div className="review-gate hud-frame">
									<span className="bi bi-hourglass-split" aria-hidden="true" />
									<p>
										{!installed
											? "Installiere und spiele das Spiel mindestens 15 Minuten, um eine Rezension zu schreiben."
											: `Spiele noch etwas weiter (mind. 15 Min), um eine Rezension zu schreiben. Bisher: ${Math.floor(playtimeSec / 60)} Min.`}
									</p>
								</div>
							)
						) : null}
					</>
				)}
			</section>

			{similar.length > 0 && <GameRow title="Ähnliche Spiele" icon="bi-grid" games={similar} />}
		</div>
	)
}
