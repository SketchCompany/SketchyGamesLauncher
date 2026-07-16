import "./pages.css"
import { useEffect, useState } from "react"
import { get } from "../lib/api.js"
import { Section, EmptyState, LoadingState } from "../components/common.jsx"

export default function Notes() {
    const [notes, setNotes] = useState(null)
    const [loading, setLoading] = useState(true)
    const [open, setOpen] = useState(0)

    useEffect(() => {
        get("/api/patch-notes")
            .then(d => setNotes(Array.isArray(d) ? d : (d ? [d] : [])))
            .catch(() => setNotes([]))
            .finally(() => setLoading(false))
    }, [])

    if (loading) return <div className="page"><LoadingState /></div>

    return (
        <div className="page">
            <Section title="Patch Notes" subtitle="Alle Änderungen am Launcher">
                {(!notes || notes.length === 0)
                    ? <EmptyState icon="bi-card-list" title="Keine Patch Notes" />
                    : notes.map((n, i) => (
                        <div className="accordion-item" key={i}>
                            <button className="accordion-head" onClick={() => setOpen(open === i ? -1 : i)}>
                                <span>Version {n.version || n.title || i + 1}</span>
                                <i className={`bi ${open === i ? "bi-chevron-up" : "bi-chevron-down"}`} />
                            </button>
                            {open === i && <div className="accordion-body">{n.notes || n.body || n.text || ""}</div>}
                        </div>
                    ))}
            </Section>
        </div>
    )
}
