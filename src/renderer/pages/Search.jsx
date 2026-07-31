import { useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { useStore } from "../lib/store.jsx"
import { useWishlist } from "../lib/wishlist.jsx"
import StoreCard from "../components/store/StoreCard.jsx"
import ErrorState from "../components/ErrorState.jsx"
import { GameRowSkeleton } from "../components/Skeletons.jsx"
import { getCategories, getDevelopers, getCategoryCounts, getTagGroups, SORT_OPTIONS, parseSort, filterGames } from "../lib/searchData.js"

/** Kleines, beschriftetes Select im Look der Web-App-Formulare. */
function SelectField({ label, value, onChange, options }) {
	return (
		<label className="block">
			<span className="mb-1.5 block text-sm font-bold text-text-secondary">{label}</span>
			<select
				value={value}
				onChange={e => onChange(e.target.value)}
				className="w-full cursor-pointer rounded border border-border-strong bg-bg-2 px-3 py-2.5 text-sm font-semibold text-text-primary transition-colors duration-200 focus:border-neon-green focus:outline-none"
			>
				{options.map(opt => (
					<option key={opt.value} value={opt.value}>{opt.label}</option>
				))}
			</select>
		</label>
	)
}

/**
 * Suche-Seite — Port des SearchExplorer der Web-App (app/suche): Volltext, Kategorie,
 * Tag-Gruppen, Entwickler, Sortierung; Zustand wird (debounced) in die URL gespiegelt.
 * Zusätzlich im Launcher: ?wunschliste=1 zeigt nur gemerkte Spiele.
 */
export default function Search() {
	const [searchParams, setSearchParams] = useSearchParams()
	const { has: inWishlist, ready: wishlistReady } = useWishlist()
	const { data: store, error: storeError, refresh } = useStore()

	// Spiele aus dem geteilten Store-Cache; null = lädt noch (Skeleton), [] = Fehler/leer.
	const games = store ? store.games || [] : storeError ? [] : null
	const [q, setQ] = useState(searchParams.get("q") ?? "")
	const [kategorie, setKategorie] = useState(searchParams.get("kategorie") ?? "")
	const [tags, setTags] = useState(() => (searchParams.get("tags") ? searchParams.get("tags").split(",").map(t => t.trim()).filter(Boolean) : []))
	const [entwickler, setEntwickler] = useState(searchParams.get("entwickler") ?? "")
	const [sortierung, setSortierung] = useState(parseSort(searchParams.get("sortierung")))
	const [wunschliste, setWunschliste] = useState(searchParams.get("wunschliste") === "1")

	const [tagQuery, setTagQuery] = useState("")
	const [openGroups, setOpenGroups] = useState({})
	const [filtersOpen, setFiltersOpen] = useState(false)
	const [catQuery, setCatQuery] = useState("")
	const [catExpanded, setCatExpanded] = useState(false)

	const allGames = games || []
	const allCategories = useMemo(() => getCategories(allGames), [allGames])
	const allDevelopers = useMemo(() => getDevelopers(allGames), [allGames])
	const categoryCounts = useMemo(() => getCategoryCounts(allGames), [allGames])
	const tagGroups = useMemo(() => getTagGroups(allGames), [allGames])

	useEffect(() => {
		if (tagGroups.length > 0) setOpenGroups(prev => (Object.keys(prev).length ? prev : { [tagGroups[0].label]: true }))
	}, [tagGroups])

	const base = wunschliste ? allGames.filter(g => inWishlist(g.id)) : allGames
	const results = useMemo(
		() => filterGames(base, { q, kategorie, tags, entwickler, sortierung }),
		[base, q, kategorie, tags, entwickler, sortierung],
	)

	// Filterzustand (debounced) in die URL spiegeln — Reload-fest.
	const firstRun = useRef(true)
	useEffect(() => {
		const handle = setTimeout(() => {
			const params = new URLSearchParams()
			if (q.trim()) params.set("q", q.trim())
			if (kategorie) params.set("kategorie", kategorie)
			if (tags.length > 0) params.set("tags", tags.join(","))
			if (entwickler) params.set("entwickler", entwickler)
			if (sortierung !== "relevanz") params.set("sortierung", sortierung)
			if (wunschliste) params.set("wunschliste", "1")
			setSearchParams(params, { replace: true })
			firstRun.current = false
		}, 250)
		return () => clearTimeout(handle)
	}, [q, kategorie, tags, entwickler, sortierung, wunschliste, setSearchParams])

	function toggleTag(tag) {
		setTags(prev => (prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]))
	}
	function toggleGroup(label) {
		setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }))
	}

	const hasFilters = Boolean(q.trim() || kategorie || tags.length > 0 || entwickler || sortierung !== "relevanz" || wunschliste)
	const activeCount = (kategorie ? 1 : 0) + tags.length + (entwickler ? 1 : 0) + (sortierung !== "relevanz" ? 1 : 0) + (wunschliste ? 1 : 0)

	function reset() {
		setQ("")
		setKategorie("")
		setTags([])
		setEntwickler("")
		setSortierung("relevanz")
		setTagQuery("")
		setWunschliste(false)
	}

	const sortLabel = SORT_OPTIONS.find(o => o.value === sortierung)?.label ?? ""
	const tagFilter = tagQuery.trim().toLowerCase()
	const catFilter = catQuery.trim().toLowerCase()
	const visibleCategories = catFilter
		? allCategories.filter(c => c.toLowerCase().includes(catFilter))
		: catExpanded
			? allCategories
			: kategorie
				? [kategorie]
				: []

	const activePills = [
		...(wunschliste ? [{ key: "wl", label: "Wunschliste", onRemove: () => setWunschliste(false) }] : []),
		...(kategorie ? [{ key: "kat", label: kategorie, onRemove: () => setKategorie("") }] : []),
		...tags.map(t => ({ key: `tag-${t}`, label: t, onRemove: () => toggleTag(t) })),
		...(entwickler ? [{ key: "dev", label: entwickler, onRemove: () => setEntwickler("") }] : []),
		...(sortierung !== "relevanz" ? [{ key: "sort", label: sortLabel, onRemove: () => setSortierung("relevanz") }] : []),
	]

	const loading = games === null || (wunschliste && !wishlistReady)

	return (
		<div className="page">
			<div className="search-explorer">
				<div className="search-topbar">
					<div className="search-bar hud-frame">
						<span className="bi bi-search" aria-hidden="true" />
						<input
							type="search"
							value={q}
							onChange={e => setQ(e.target.value)}
							placeholder="Spiele, Kategorien, Tags & Entwickler durchsuchen…"
							aria-label="Spiele durchsuchen"
							spellCheck={false}
							autoComplete="off"
						/>
						{q && (
							<button type="button" className="search-bar__clear" onClick={() => setQ("")} aria-label="Suche leeren">
								<span className="bi bi-x-lg" aria-hidden="true" />
							</button>
						)}
					</div>
					<button
						type="button"
						onClick={() => setWunschliste(v => !v)}
						className={`cta ${wunschliste ? "cta-primary" : "cta-secondary"} search-wishlist`}
						aria-pressed={wunschliste}
					>
						<span className={`bi ${wunschliste ? "bi-star-fill" : "bi-star"}`} aria-hidden="true" /> Wunschliste
					</button>
				</div>

				<div className="search-layout">
					{filtersOpen && <div className="search-backdrop" onClick={() => setFiltersOpen(false)} aria-hidden="true" />}

					<aside className={`search-sidebar${filtersOpen ? " search-sidebar--open" : ""}`} aria-label="Filter">
						<div className="search-sidebar__head">
							<p className="search-sidebar__title">
								<span className="bi bi-funnel" aria-hidden="true" /> Filter
							</p>
							<button type="button" className="search-sidebar__close" onClick={() => setFiltersOpen(false)} aria-label="Filter schließen">
								<span className="bi bi-x-lg" aria-hidden="true" />
							</button>
						</div>

						<div className="filter-section">
							<SelectField
								label="Entwickler"
								value={entwickler}
								onChange={setEntwickler}
								options={[{ value: "", label: "Alle Entwickler" }, ...allDevelopers.map(d => ({ value: d, label: d }))]}
							/>
						</div>

						<div className="filter-section">
							<SelectField label="Sortieren nach" value={sortierung} onChange={v => setSortierung(parseSort(v))} options={SORT_OPTIONS} />
						</div>

						<div className="filter-section">
							<p className="search-filter__label">
								Kategorie {kategorie && <span className="search-filter__hint">(aktiv)</span>}
							</p>
							<div className="tag-search">
								<span className="bi bi-search" aria-hidden="true" />
								<input
									type="text"
									value={catQuery}
									onChange={e => setCatQuery(e.target.value)}
									placeholder="Kategorie suchen…"
									aria-label="Kategorien filtern"
									spellCheck={false}
									autoComplete="off"
								/>
								{catQuery && (
									<button type="button" onClick={() => setCatQuery("")} aria-label="Kategorie-Suche leeren">
										<span className="bi bi-x" aria-hidden="true" />
									</button>
								)}
							</div>
							<div className="filter-list">
								<button type="button" className={`filter-option${kategorie === "" ? " filter-option--active" : ""}`} onClick={() => setKategorie("")}>
									<span>Alle</span>
									<span className="filter-option__count">{allGames.length}</span>
								</button>
								{visibleCategories.map(cat => (
									<button
										key={cat}
										type="button"
										className={`filter-option${kategorie === cat ? " filter-option--active" : ""}`}
										onClick={() => setKategorie(cat === kategorie ? "" : cat)}
									>
										<span>{cat}</span>
										<span className="filter-option__count">{categoryCounts[cat] ?? 0}</span>
									</button>
								))}
								{!catFilter && (
									<button
										type="button"
										className={`filter-toggle${catExpanded ? " filter-toggle--open" : ""}`}
										onClick={() => setCatExpanded(v => !v)}
										aria-expanded={catExpanded}
									>
										<span className="bi bi-chevron-right filter-toggle__chevron" aria-hidden="true" />
										{catExpanded ? "Weniger anzeigen" : "Weitere Kategorien"}
									</button>
								)}
							</div>
						</div>

						<div className="filter-section">
							<p className="search-filter__label">
								Tags {tags.length > 0 && <span className="search-filter__hint">({tags.length} aktiv)</span>}
							</p>
							<div className="tag-search">
								<span className="bi bi-search" aria-hidden="true" />
								<input
									type="text"
									value={tagQuery}
									onChange={e => setTagQuery(e.target.value)}
									placeholder="Tag suchen…"
									aria-label="Tags filtern"
									spellCheck={false}
									autoComplete="off"
								/>
								{tagQuery && (
									<button type="button" onClick={() => setTagQuery("")} aria-label="Tag-Suche leeren">
										<span className="bi bi-x" aria-hidden="true" />
									</button>
								)}
							</div>

							<div className="tag-groups">
								{tagGroups.map(group => {
									const visible = tagFilter ? group.tags.filter(t => t.toLowerCase().includes(tagFilter)) : group.tags
									if (visible.length === 0) return null
									const open = tagFilter ? true : Boolean(openGroups[group.label])
									const activeInGroup = group.tags.filter(t => tags.includes(t)).length
									return (
										<div key={group.label} className={`tag-group${open ? " tag-group--open" : ""}`}>
											<button type="button" className="tag-group__head" onClick={() => toggleGroup(group.label)} aria-expanded={open} disabled={Boolean(tagFilter)}>
												<span className="bi bi-chevron-right tag-group__chevron" aria-hidden="true" />
												<span className="tag-group__label">{group.label}</span>
												{activeInGroup > 0 && <span className="tag-group__badge">{activeInGroup}</span>}
											</button>
											{open && (
												<div className="tag-group__body">
													<div className="tag-grid">
														{visible.map(tag => (
															<button key={tag} type="button" className={`tag-option${tags.includes(tag) ? " tag-option--active" : ""}`} onClick={() => toggleTag(tag)}>
																{tag}
															</button>
														))}
													</div>
												</div>
											)}
										</div>
									)
								})}
							</div>
						</div>

						{hasFilters && (
							<button type="button" className="cta cta-ghost sidebar-reset" onClick={reset}>
								<span className="bi bi-arrow-counterclockwise" aria-hidden="true" /> Filter zurücksetzen
							</button>
						)}
					</aside>

					<div className="search-main">
						<div className="search-toolbar">
							<button type="button" className="filters-toggle" onClick={() => setFiltersOpen(true)}>
								<span className="bi bi-funnel" aria-hidden="true" /> Filter
								{activeCount > 0 && <span className="filters-toggle__badge">{activeCount}</span>}
							</button>
							<p className="search-results__count">
								<strong>{results.length}</strong> {results.length === 1 ? "Spiel" : "Spiele"}
							</p>
						</div>

						{activePills.length > 0 && (
							<div className="active-filters">
								{activePills.map(pill => (
									<button key={pill.key} type="button" className="active-filter" onClick={pill.onRemove} aria-label={`${pill.label} entfernen`}>
										{pill.label}
										<span className="bi bi-x" aria-hidden="true" />
									</button>
								))}
								<button type="button" className="active-filters__reset" onClick={reset}>
									Alle zurücksetzen
								</button>
							</div>
						)}

						{loading ? (
							<GameRowSkeleton cards={8} />
						) : storeError && !store ? (
							<ErrorState error={storeError} onRetry={refresh} />
						) : results.length === 0 ? (
							<div className="search-empty hud-frame">
								<span className="bi bi-controller" aria-hidden="true" />
								<p>Keine Spiele gefunden. Versuch es mit anderen Suchbegriffen oder weniger Filtern.</p>
								{hasFilters && (
									<button type="button" className="cta cta-secondary" onClick={reset}>
										Filter zurücksetzen
									</button>
								)}
							</div>
						) : (
							<div className="search-grid">
								{results.map(game => (
									<StoreCard key={game.id} game={game} />
								))}
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	)
}
