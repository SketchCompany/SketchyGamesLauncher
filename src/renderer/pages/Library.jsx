import "./pages.css"
import { useEffect, useMemo, useState } from "react"
import { get, send } from "../lib/api.js"
import { Button, Card, Input } from "../components/ui/index.jsx"
import { EmptyState, LoadingState } from "../components/common.jsx"
import { useNotify } from "../lib/notifications.jsx"
import { useDialog } from "../lib/dialog.jsx"

const FILTERS = [
    { key: "all", label: "Alle" },
    { key: "games", label: "Spiele" },
    { key: "softwares", label: "Software" },
]

export default function Library() {
    const [installs, setInstalls] = useState(null)
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState("all")
    const [query, setQuery] = useState("")
    const notify = useNotify()
    const { confirm } = useDialog()

    const load = () => {
        setLoading(true)
        get("/api/installs").then(setInstalls).catch(() => setInstalls(null)).finally(() => setLoading(false))
    }
    useEffect(load, [])

    const items = useMemo(() => {
        if (!installs) return []
        const g = (installs.games || []).map(x => ({ ...x, _type: "games" }))
        const s = (installs.softwares || []).map(x => ({ ...x, _type: "softwares" }))
        let all = filter === "games" ? g : filter === "softwares" ? s : [...g, ...s]
        const q = query.trim().toLowerCase()
        if (q) all = all.filter(x => x.name?.toLowerCase().includes(q))
        return all
    }, [installs, filter, query])

    async function play(item) {
        try {
            await send("/api/games/start", { filepath: item.start, name: item.name }, true)
            notify("Gestartet", `${item.name} wurde gestartet.`, "success")
        } catch (err) { notify("Fehler", "Konnte nicht starten: " + err, "error") }
    }
    async function openFolder(item) {
        try { await send("/api/games/open", { filepath: item.start, name: item.name }, true) }
        catch (err) { notify("Fehler", String(err), "error") }
    }
    async function remove(item) {
        if (!await confirm("Deinstallieren?", `Soll „${item.name}" wirklich entfernt werden?`)) return
        try {
            await send("/api/games/delete", { filepath: item.start, name: item.name }, true)
            notify("Entfernt", `${item.name} wurde deinstalliert.`, "note")
            load()
        } catch (err) { notify("Fehler", String(err), "error") }
    }
    async function checkUpdates() {
        notify("Update-Suche", "Suche nach Updates…", "note", 3000)
        try { await get("/api/updates") } catch { /* noop */ }
    }

    return (
        <div className="page">
            <div className="filter-row">
                {FILTERS.map(f => (
                    <Button key={f.key} size="sm" variant={filter === f.key ? "primary" : "default"}
                        onClick={() => setFilter(f.key)}>{f.label}</Button>
                ))}
                <span className="spacer" />
                <Input placeholder="Suchen…" value={query} onChange={e => setQuery(e.target.value)} style={{ maxWidth: 220 }} />
                <Button size="sm" variant="ghost" onClick={checkUpdates}><i className="bi bi-arrow-repeat" /> Updates</Button>
            </div>

            {loading ? <LoadingState label="Bibliothek wird geladen…" />
                : items.length === 0
                    ? <EmptyState icon="bi-controller" title="Noch nichts installiert" hint="Entdecke Spiele im Store." />
                    : (
                        <div className="product-grid">
                            {items.map((item, i) => (
                                <Card hover className="product-card" key={i}>
                                    <div className="product-card__cover">
                                        <img
                                            src={`/api/library/img/${encodeURIComponent(item.name)}?installationPath=${encodeURIComponent(item.installationPath || "")}`}
                                            alt={item.name}
                                            onError={e => { e.currentTarget.style.display = "none" }}
                                        />
                                    </div>
                                    <div className="product-card__body">
                                        <span className="product-card__cat">{item._type === "softwares" ? "Software" : "Spiel"}</span>
                                        <span className="product-card__title">{item.name}</span>
                                        <span className="product-card__dev">{item.version ? `v${item.version}` : ""} {item.size ? `· ${item.size}` : ""}</span>
                                        <div className="product-card__foot" style={{ gap: 8 }}>
                                            <Button size="sm" variant="primary" onClick={() => play(item)}><i className="bi bi-play-fill" /> Spielen</Button>
                                            <span style={{ display: "flex", gap: 4 }}>
                                                <Button size="sm" variant="icon" onClick={() => openFolder(item)} aria-label="Ordner öffnen"><i className="bi bi-folder2-open" /></Button>
                                                <Button size="sm" variant="icon" onClick={() => remove(item)} aria-label="Deinstallieren"><i className="bi bi-trash" /></Button>
                                            </span>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}
        </div>
    )
}
