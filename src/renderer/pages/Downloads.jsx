import "./pages.css"
import { useEffect, useRef, useState } from "react"
import { get } from "../lib/api.js"
import { Button, Card } from "../components/ui/index.jsx"
import { Section, EmptyState, LoadingState } from "../components/common.jsx"

export default function Downloads() {
    const [queue, setQueue] = useState(null)
    const [progress, setProgress] = useState(null)
    const [paused, setPaused] = useState(false)
    const [loading, setLoading] = useState(true)
    const timer = useRef(null)

    const loadQueue = () => get("/api/downloads").then(d => setQueue(d?.downloadQueue || [])).catch(() => setQueue([]))

    useEffect(() => {
        loadQueue().finally(() => setLoading(false))
        get("/api/download/state").then(s => setPaused(!!s?.paused)).catch(() => {})
        timer.current = setInterval(async () => {
            try {
                const p = await get("/api/download/progress")
                setProgress(p)
                if (p?.percentage >= 100 || p == null) loadQueue()
            } catch { /* noop */ }
        }, 1000)
        return () => clearInterval(timer.current)
    }, [])

    async function toggle() {
        try {
            if (paused) { await get("/api/download/resume"); setPaused(false) }
            else { await get("/api/download/pause"); setPaused(true) }
        } catch { /* noop */ }
    }

    if (loading) return <div className="page"><LoadingState /></div>

    const pct = Math.max(0, Math.min(100, Number(progress?.percentage) || 0))
    const active = queue && queue.length > 0

    return (
        <div className="page">
            <Section title="Aktueller Download">
                {active ? (
                    <Card pad>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: 17 }}>{queue[0].name}</h3>
                                <span style={{ color: "var(--text-muted)", fontSize: 13 }}>
                                    {progress?.speed ? `${progress.speed} · ` : ""}{pct.toFixed(0)} %
                                </span>
                            </div>
                            <Button size="sm" variant="ghost" onClick={toggle}>
                                <i className={`bi ${paused ? "bi-play-fill" : "bi-pause-fill"}`} /> {paused ? "Fortsetzen" : "Pausieren"}
                            </Button>
                        </div>
                        <div className="progress"><span style={{ width: `${pct}%` }} /></div>
                    </Card>
                ) : <EmptyState icon="bi-cloud-check" title="Keine aktiven Downloads" hint="Lade Spiele aus dem Store herunter." />}
            </Section>

            {active && queue.length > 1 && (
                <Section title="Warteschlange">
                    {queue.slice(1).map((q, i) => (
                        <Card pad key={i} style={{ marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontWeight: 700 }}>{q.name}</span>
                            <span style={{ color: "var(--text-muted)", fontSize: 13 }}>{q.size || ""} {q.version ? `· v${q.version}` : ""}</span>
                        </Card>
                    ))}
                </Section>
            )}
        </div>
    )
}
