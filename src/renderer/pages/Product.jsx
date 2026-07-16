import "./pages.css"
import { useEffect, useState } from "react"
import { useLocation, useParams } from "react-router-dom"
import { get, send } from "../lib/api.js"
import { Button, Card } from "../components/ui/index.jsx"
import { LoadingState, EmptyState, titleOf, coverFor, effectivePrice, formatPrice } from "../components/common.jsx"
import { useNotify } from "../lib/notifications.jsx"

export default function Product() {
    const { product: param } = useParams()
    const { state } = useLocation()
    const notify = useNotify()
    const [product, setProduct] = useState(state?.product || null)
    const [loading, setLoading] = useState(!state?.product)
    const [busy, setBusy] = useState(false)
    const [img, setImg] = useState(0)

    useEffect(() => {
        if (product) return
        // Fallback: das Produkt im Store-Payload per ID nachschlagen (Direktaufruf/Reload).
        get("/api/store").then(d => {
            const all = Array.isArray(d?.games) ? d.games : []
            setProduct(all.find(p => String(p.id) === param) || null)
        }).catch(() => setProduct(null)).finally(() => setLoading(false))
    }, [param, product])

    if (loading) return <div className="page"><LoadingState /></div>
    if (!product) return <div className="page"><EmptyState icon="bi-question-circle" title="Produkt nicht gefunden" /></div>

    // Galerie: Screenshots (Array von URLs), sonst media, sonst das Thumbnail.
    const gallery = (Array.isArray(product.screenshots) && product.screenshots.length ? product.screenshots
        : Array.isArray(product.media) ? product.media.map(m => (typeof m === "string" ? m : m?.url)).filter(Boolean)
        : []).filter(Boolean)
    const images = gallery.length ? gallery : (coverFor(product) ? [coverFor(product)] : [])
    const price = effectivePrice(product)
    const hasBuild = !!product.downloadUrl // vom storeAdapter angereichert (React /api/launcher/games)

    async function download() {
        setBusy(true)
        try {
            // Neuer Descriptor: ID + Web-Host-Download-URL + sha256; installationPath berechnet die BFF lokal.
            await send("/api/download", { id: product.id, name: product.id, title: titleOf(product), downloadUrl: product.downloadUrl, sha256: product.sha256 })
            notify("Download gestartet", `${titleOf(product)} wird heruntergeladen.`, "success")
        } catch (err) {
            notify("Fehler", "Download konnte nicht gestartet werden: " + err, "error")
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className="page">
            <div className="home-hero" style={{ marginBottom: 32 }}>
                <Card className="product-card__cover" style={{ aspectRatio: "16/9", borderRadius: "var(--radius-lg)" }}>
                    {images.length > 0
                        ? <img src={images[img]} alt={titleOf(product)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : <div className="product-card__cover empty"><i className="bi bi-image" /></div>}
                    {images.length > 1 && (
                        <div style={{ position: "absolute", bottom: 12, left: 0, right: 0, display: "flex", gap: 6, justifyContent: "center" }}>
                            {images.map((_, i) => (
                                <button key={i} onClick={() => setImg(i)} aria-label={`Bild ${i + 1}`}
                                    style={{ width: 9, height: 9, borderRadius: 99, border: "none", cursor: "pointer",
                                        background: i === img ? "var(--neon-green)" : "var(--border-strong)" }} />
                            ))}
                        </div>
                    )}
                </Card>
                <div>
                    <span className="eyebrow">{product.category || "Spiel"}</span>
                    <h1 style={{ marginTop: 8 }}>{titleOf(product)}</h1>
                    {product.tagline && <p style={{ color: "var(--text-muted)" }}>{product.tagline}</p>}
                    <p style={{ fontWeight: 800, fontSize: 18, margin: "10px 0" }}>
                        {product.owned ? "In deiner Bibliothek" : formatPrice(price)}
                        {!product.owned && product.currentDiscount ? <span style={{ color: "var(--neon-green)", marginLeft: 8 }}>−{product.currentDiscount}%</span> : null}
                    </p>
                    <p>{product.description || "Keine Beschreibung verfügbar."}</p>
                    {product.comingSoon ? (
                        <Button variant="ghost" disabled><i className="bi bi-hourglass-split" /> Bald verfügbar</Button>
                    ) : hasBuild ? (
                        <Button variant="primary" onClick={download} disabled={busy}>
                            <i className="bi bi-download" /> {busy ? "Startet…" : product.owned ? "Herunterladen" : price > 0 ? "Kaufen & laden" : "Kostenlos laden"}
                        </Button>
                    ) : (
                        <Button variant="ghost" disabled><i className="bi bi-slash-circle" /> Kein Build verfügbar</Button>
                    )}
                </div>
            </div>
        </div>
    )
}
