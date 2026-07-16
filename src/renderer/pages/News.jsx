import "./pages.css"
import { useEffect, useState } from "react"
import { get } from "../lib/api.js"
import { Card } from "../components/ui/index.jsx"
import { Section, EmptyState, LoadingState } from "../components/common.jsx"

export default function News() {
    const [items, setItems] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        get("/api/patch-notes")
            .then(d => setItems(Array.isArray(d) ? d : (d ? [d] : [])))
            .catch(() => setItems([]))
            .finally(() => setLoading(false))
    }, [])

    if (loading) return <div className="page"><LoadingState /></div>

    return (
        <div className="page">
            <Section title="News" subtitle="Neuigkeiten rund um Sketchy Games">
                {(!items || items.length === 0)
                    ? <EmptyState icon="bi-newspaper" title="Keine News" />
                    : (
                        <div className="product-grid">
                            {items.map((n, i) => (
                                <Card pad hover key={i}>
                                    <span className="eyebrow">{n.version ? `Version ${n.version}` : "Update"}</span>
                                    <h3 style={{ margin: "10px 0 8px", fontSize: 18 }}>{n.title || n.version || "Neuigkeit"}</h3>
                                    <p style={{ margin: 0, fontSize: 14 }}>{n.notes || n.body || n.text || ""}</p>
                                </Card>
                            ))}
                        </div>
                    )}
            </Section>
        </div>
    )
}
