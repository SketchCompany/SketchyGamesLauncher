import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import RefreshButton from "./RefreshButton.jsx"

/**
 * Suchfeld oben auf der Store-Seite (Web-Port). Leitet die Eingabe an die Suche weiter
 * (`/search?q=…`); die eigentliche Suchlogik lebt in pages/Search.jsx + lib/searchData.js.
 */
export default function StoreSearchBar() {
	const navigate = useNavigate()
	const [q, setQ] = useState("")

	function submit(e) {
		e.preventDefault()
		const query = q.trim()
		navigate(query ? `/search?q=${encodeURIComponent(query)}` : "/search")
	}

	return (
		<form className="store-search" onSubmit={submit} role="search">
			<span className="bi bi-search store-search__icon" aria-hidden="true" />
			<input
				type="search"
				value={q}
				onChange={e => setQ(e.target.value)}
				placeholder="Spiele, Kategorien, Tags & Entwickler durchsuchen…"
				aria-label="Spiele durchsuchen"
				spellCheck={false}
				autoComplete="off"
			/>
			<button type="submit" className="cta cta-secondary store-search__btn">
				<span className="bi bi-search" aria-hidden="true" /> Suchen
			</button>
			<Link to="/search?wunschliste=1" className="cta cta-secondary store-search__wishlist">
				<span className="bi bi-star" aria-hidden="true" /> Wunschliste
			</Link>
			<RefreshButton compact />
		</form>
	)
}
