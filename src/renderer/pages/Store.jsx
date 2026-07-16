import "./pages.css"
import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { get } from "../lib/api.js"
import { Input } from "../components/ui/index.jsx"
import { Section, ProductCard, EmptyState, LoadingState, titleOf, coverFor } from "../components/common.jsx"

export default function Store() {
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [query, setQuery] = useState("")
    const navigate = useNavigate()

    useEffect(() => {
        get("/api/store")
            .then(d => setData(d))
            .catch(() => setData(null))
            .finally(() => setLoading(false))
    }, [])

    // Navigation/Lookup laufen jetzt über die Spiel-ID (Slug), nicht mehr über den Namen.
    const open = (p) => navigate(`/store/${encodeURIComponent(p.id)}`, { state: { product: p } })

    const games = useMemo(() => (data && Array.isArray(data.games) ? data.games : []), [data])

    const results = useMemo(() => {
        const q = query.trim().toLowerCase()
        if (!q) return null
        return games.filter(p =>
            titleOf(p).toLowerCase().includes(q) ||
            String(p.category || "").toLowerCase().includes(q)
        )
    }, [query, games])

    if (loading) return <div className="page"><LoadingState label="Store wird geladen…" /></div>
    if (!data) return <div className="page"><EmptyState icon="bi-wifi-off" title="Store nicht erreichbar" hint="Prüfe deine Internetverbindung oder melde dich neu an." /></div>

    // Hero: bevorzugt ein Featured-Spiel, sonst das erste im Katalog.
    const hero = games.find(g => g.featured) || games[0] || null
    const categories = Array.isArray(data.categories) ? data.categories : []

    return (
        <div className="page">
            {hero && (
                <div className="store-hero" onClick={() => open(hero)} style={{ cursor: "pointer" }}>
                    {coverFor(hero) && <img src={coverFor(hero)} alt={titleOf(hero)} />}
                    <div className="store-hero__overlay">
                        <span className="eyebrow">Empfohlen</span>
                        <h2>{titleOf(hero)}</h2>
                    </div>
                </div>
            )}

            <div className="searchbar">
                <Input placeholder="Spiele suchen…" value={query} onChange={e => setQuery(e.target.value)} />
            </div>

            {results ? (
                <Section title="Suchergebnisse" subtitle={`${results.length} Treffer`}>
                    {results.length === 0
                        ? <EmptyState icon="bi-search" title="Keine Treffer" hint="Versuch einen anderen Suchbegriff." />
                        : <div className="product-grid">{results.map((p) => <ProductCard key={p.id} product={p} onClick={() => open(p)} />)}</div>}
                </Section>
            ) : (
                <>
                    {/* Dynamische Kategorien aus der API (Beliebt, Neu, Best bewertet, …). */}
                    {categories.map((cat) => (
                        <StoreRow key={cat.key} title={cat.title} items={cat.games} onOpen={open} />
                    ))}
                    <StoreGrid title="Alle Spiele" items={games} onOpen={open} />
                </>
            )}
        </div>
    )
}

function StoreRow({ title, items, onOpen }) {
    if (!items || items.length === 0) return null
    return (
        <Section title={title}>
            <div className="scroller">
                {items.map((p) => <ProductCard key={p.id} product={p} onClick={() => onOpen(p)} />)}
            </div>
        </Section>
    )
}

function StoreGrid({ title, items, onOpen }) {
    if (!items || items.length === 0) return null
    return (
        <Section title={title}>
            <div className="product-grid">
                {items.map((p) => <ProductCard key={p.id} product={p} onClick={() => onOpen(p)} />)}
            </div>
        </Section>
    )
}
