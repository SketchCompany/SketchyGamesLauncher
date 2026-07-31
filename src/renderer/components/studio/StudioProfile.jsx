import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import StoreCard from "../store/StoreCard.jsx"
import StudioSectionView from "./StudioSections.jsx"
import StudioSocial from "./StudioSocial.jsx"
import ContentBlocks from "./ContentBlocks.jsx"

const TABS = [
	{ id: "start", label: "Startseite", icon: "bi-house" },
	{ id: "spiele", label: "Alle Spiele", icon: "bi-grid" },
	{ id: "kategorien", label: "Kategorien", icon: "bi-tag" },
	{ id: "suchen", label: "Suchen", icon: "bi-search" },
	{ id: "ueber", label: "Über", icon: "bi-info-circle" },
]

/** Standard-Startseite, wenn der Entwickler noch keine Abschnitte angelegt hat. */
function defaultSections(games) {
	if (games.length === 0) return []
	const top = [...games].sort((a, b) => (b.downloads ?? 0) - (a.downloads ?? 0))[0]
	const out = [{ id: "d-spot", type: "spotlight", gameId: top.id, title: "Spotlight" }]
	if (games.length >= 4) {
		out.push({ id: "d-pop", type: "generated", source: "popular", title: "Beliebteste Spiele" })
		out.push({ id: "d-new", type: "generated", source: "newest", title: "Neue Spiele" })
	}
	return out
}

/**
 * Entwickler-/Studio-Profil — Port aus der Web-App (studio-profile.tsx). Ohne Owner-Leiste /
 * Dashboard-Verweise (im Launcher nicht relevant); Links über react-router statt next.
 */
export default function StudioProfile({ studio, games }) {
	const [tab, setTab] = useState("start")
	const [reduceMotion, setReduceMotion] = useState(false)
	const [query, setQuery] = useState("")
	const [activeCat, setActiveCat] = useState("")

	useEffect(() => {
		if (typeof window === "undefined") return
		setReduceMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches)
	}, [])

	const hasGames = games.length > 0
	const visibleTabs = hasGames ? TABS : TABS.filter(t => t.id === "start" || t.id === "ueber")

	const sections = studio.homepageSections && studio.homepageSections.length > 0 ? studio.homepageSections : defaultSections(games)
	const categories = useMemo(() => Array.from(new Set(games.map(g => g.category))).sort((a, b) => String(a).localeCompare(String(b), "de")), [games])

	const searchResults = useMemo(() => {
		const q = query.trim().toLowerCase()
		if (!q) return games
		return games.filter(g => g.title.toLowerCase().includes(q) || (g.category ?? "").toLowerCase().includes(q) || (g.tags ?? []).some(t => t.toLowerCase().includes(q)))
	}, [games, query])

	const catGames = activeCat ? games.filter(g => g.category === activeCat) : games
	const hasBanner = Boolean(studio.bannerPath)

	return (
		<div className="studio-page">
			<header className={`studio-hero${hasBanner ? " studio-hero--banner" : ""}`}>
				{studio.bannerPath ? (
					studio.bannerKind === "video" ? (
						<video className="studio-hero__bg-media" src={studio.bannerPath} muted loop playsInline autoPlay={!reduceMotion} poster={studio.avatarPath ?? undefined} aria-hidden="true" />
					) : (
						<img className="studio-hero__bg-media" src={studio.bannerPath} alt="" aria-hidden="true" />
					)
				) : (
					<div className={`studio-hero__bg-fallback game-thumb--${studio.accent}`} aria-hidden="true" />
				)}
				<div className="studio-hero__shade" />
				<div className="studio-hero__caption">
					<div className="studio-hero__identity">
						{studio.avatarPath ? (
							<img className="studio-hero__avatar" src={studio.avatarPath} alt={`${studio.name} Logo`} width={72} height={72} />
						) : (
							<span className={`bi ${studio.icon} studio-hero__avatar studio-hero__avatar--icon`} aria-hidden="true" />
						)}
						<div>
							<p className="eyebrow">Entwickler-Studio</p>
							<h1 className="studio-hero__name">{studio.name}</h1>
						</div>
					</div>
					<div className="studio-hero__stats">
						<span className="studio-stat" title="Spiele">
							<span className="bi bi-controller" aria-hidden="true" /> <strong>{studio.gameCount}</strong> Spiele
						</span>
						<span className="studio-stat" title="Downloads">
							<span className="bi bi-download" aria-hidden="true" /> <strong>{studio.downloads.toLocaleString("de-DE")}</strong> Downloads
						</span>
						{studio.genres.length > 0 && (
							<span className="studio-stat">
								<span className="bi bi-tag" aria-hidden="true" /> {studio.genres.slice(0, 3).join(", ")}
							</span>
						)}
					</div>
				</div>
			</header>

			{studio.archived && (
				<div className="archived-note" role="note">
					<span className="bi bi-archive" aria-hidden="true" />
					<span>
						<strong>Archiviert.</strong> Dieser Entwickler hat sich aufgelöst und veröffentlicht keine Updates mehr. Die Spiele bleiben spielbar.
					</span>
				</div>
			)}

			<div className="studio-layout">
				<div className="studio-intro">
					<p className="studio-bio">{studio.bio}</p>
					<StudioSocial website={studio.website} links={studio.socialLinks} />
				</div>

				<div className="studio-main">
					<nav className="studio-tabs" role="tablist" aria-label="Studio-Bereiche">
						{visibleTabs.map(t => (
							<button key={t.id} role="tab" aria-selected={tab === t.id} className={`studio-tab${tab === t.id ? " active" : ""}`} onClick={() => setTab(t.id)}>
								<span className={`bi ${t.icon}`} aria-hidden="true" /> {t.label}
							</button>
						))}
					</nav>

					<div className="studio-tabpanel" role="tabpanel">
						{tab === "start" &&
							(sections.length > 0 ? (
								sections.map(s => <StudioSectionView key={s.id} section={s} games={games} />)
							) : !hasGames ? (
								<div className="studio-empty-notice" role="note">
									<span className="bi bi-controller" aria-hidden="true" />
									<p>Dieser Entwickler hat noch keine Spiele veröffentlicht. Schau später wieder vorbei.</p>
								</div>
							) : (
								<p className="studio-section__empty">Dieses Studio hat noch keine Inhalte veröffentlicht.</p>
							))}

						{tab === "spiele" && (
							<div className="studio-section__grid">
								{games.map(g => (
									<StoreCard key={g.id} game={g} />
								))}
							</div>
						)}

						{tab === "kategorien" && (
							<>
								<div className="studio-catnav">
									<button type="button" className={`studio-catnav__btn${activeCat === "" ? " active" : ""}`} onClick={() => setActiveCat("")}>
										Alle
									</button>
									{categories.map(c => (
										<button key={c} type="button" className={`studio-catnav__btn${activeCat === c ? " active" : ""}`} onClick={() => setActiveCat(c)}>
											{c}
										</button>
									))}
								</div>
								<div className="studio-section__grid">
									{catGames.map(g => (
										<StoreCard key={g.id} game={g} />
									))}
								</div>
							</>
						)}

						{tab === "suchen" && (
							<>
								<div className="studio-search">
									<span className="bi bi-search" aria-hidden="true" />
									<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={`Spiele von ${studio.name} durchsuchen…`} aria-label="Studio-Spiele durchsuchen" spellCheck={false} />
								</div>
								<div className="studio-section__grid">
									{searchResults.map(g => (
										<StoreCard key={g.id} game={g} />
									))}
								</div>
								{searchResults.length === 0 && <p className="studio-section__empty">Keine Treffer.</p>}
							</>
						)}

						{tab === "ueber" && (
							<div className="studio-about">
								{studio.aboutContent && studio.aboutContent.length > 0 ? (
									<ContentBlocks blocks={studio.aboutContent} />
								) : (
									<div className="studio-about__placeholder">
										<p className="studio-section__empty">Hier gibt es bald mehr über dieses Studio zu erfahren.</p>
									</div>
								)}
								{studio.genres.length > 0 && (
									<div className="studio-about__genres">
										<span className="bi bi-tag" aria-hidden="true" />
										{studio.genres.map(g => (
											<Link key={g} to={`/search?tags=${encodeURIComponent(g)}&entwickler=${encodeURIComponent(studio.name)}`} className="store-tag">
												{g}
											</Link>
										))}
									</div>
								)}
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	)
}
