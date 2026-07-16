import "./pages.css"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { get, send } from "../lib/api.js"
import { Button, Card } from "../components/ui/index.jsx"
import { Section, ProductCard, LoadingState } from "../components/common.jsx"
import { useNotify } from "../lib/notifications.jsx"

export default function Home() {
    const [lastPlayed, setLastPlayed] = useState(null)
    const [store, setStore] = useState(null)
    const [note, setNote] = useState(null)
    const [loading, setLoading] = useState(true)
    const navigate = useNavigate()
    const notify = useNotify()

    useEffect(() => {
        Promise.allSettled([
            get("/api/lastplayed"),
            get("/api/store"),
            get("/api/patch-notes"),
        ]).then(([lp, st, pn]) => {
            if (lp.status === "fulfilled") setLastPlayed(lp.value)
            if (st.status === "fulfilled") setStore(st.value)
            if (pn.status === "fulfilled") setNote(Array.isArray(pn.value) ? pn.value[0] : pn.value)
        }).finally(() => setLoading(false))
    }, [])

    async function playLast() {
        if (!lastPlayed?.start) return
        try {
            await send("/api/games/start", { filepath: lastPlayed.start, name: lastPlayed.name }, true)
            notify("Gestartet", `${lastPlayed.name} wurde gestartet.`, "success")
        } catch (err) { notify("Fehler", String(err), "error") }
    }

    if (loading) return <div className="page"><LoadingState /></div>

    // Showcase aus der neuen Katalogform: erste Kategorie, sonst der flache games-Katalog.
    const showcase = store
        ? ((store.categories && store.categories[0] && store.categories[0].games) || store.games || []).slice(0, 8)
        : []

    return (
        <div className="page">
            <div className="home-hero">
                <div className="home-hero__main">
                    <span className="eyebrow">Willkommen zurück</span>
                    <h1 className="gradient-text" style={{ marginTop: 8 }}>Sketchy Games</h1>
                    <p style={{ maxWidth: 460 }}>Entdecke neue Spiele, verwalte deine Bibliothek und bleib auf dem neuesten Stand.</p>
                    <div style={{ display: "flex", gap: 10 }}>
                        <Button variant="primary" onClick={() => navigate("/store")}><i className="bi bi-bag" /> Zum Store</Button>
                        <Button variant="ghost" onClick={() => navigate("/library")}><i className="bi bi-controller" /> Bibliothek</Button>
                    </div>
                </div>
                <div className="home-hero__side">
                    <Card pad>
                        <span className="eyebrow">Zuletzt gespielt</span>
                        {lastPlayed?.name ? (
                            <>
                                <h3 style={{ margin: "10px 0 14px" }}>{lastPlayed.name}</h3>
                                <Button variant="primary" onClick={playLast}><i className="bi bi-play-fill" /> Fortsetzen</Button>
                            </>
                        ) : <p style={{ margin: "10px 0 0", color: "var(--text-muted)" }}>Noch kein Spiel gespielt.</p>}
                    </Card>
                    {note && (
                        <Card pad>
                            <span className="eyebrow">Neueste Patch Note</span>
                            <h3 style={{ margin: "10px 0 6px", fontSize: 16 }}>{note.version || note.title || "Update"}</h3>
                            <p style={{ margin: 0, fontSize: 13, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                                {note.notes || note.body || note.text || ""}
                            </p>
                            <Button size="sm" variant="ghost" style={{ marginTop: 12 }} onClick={() => navigate("/notes")}>Mehr</Button>
                        </Card>
                    )}
                </div>
            </div>

            {showcase.length > 0 && (
                <Section title="Aus dem Store" action={<Button size="sm" variant="ghost" onClick={() => navigate("/store")}>Alle ansehen</Button>}>
                    <div className="scroller">
                        {showcase.map((p) => (
                            <ProductCard key={p.id} product={p} onClick={() => navigate(`/store/${encodeURIComponent(p.id)}`, { state: { product: p } })} />
                        ))}
                    </div>
                </Section>
            )}
        </div>
    )
}
