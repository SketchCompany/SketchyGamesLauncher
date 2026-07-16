import { Card, Badge, Spinner } from "./ui/index.jsx"

export function Section({ title, subtitle, children, action }) {
    return (
        <section className="section">
            <div className="section__head">
                <div>
                    <h2>{title}</h2>
                    {subtitle && <p>{subtitle}</p>}
                </div>
                {action}
            </div>
            {children}
        </section>
    )
}

export function EmptyState({ icon = "bi-inbox", title, hint }) {
    return (
        <div className="state-center">
            <i className={`bi ${icon}`} />
            <div>
                <h3 style={{ margin: 0 }}>{title}</h3>
                {hint && <p style={{ margin: "6px 0 0" }}>{hint}</p>}
            </div>
        </div>
    )
}

export function LoadingState({ label = "Lädt…" }) {
    return (
        <div className="state-center">
            <Spinner />
            <p style={{ margin: 0 }}>{label}</p>
        </div>
    )
}

// --- Store-Item-Helfer (neue v1-Katalogform { id, title, thumbnail, category, price, owned, … }) ---

// Titel des Store-Items (Fallback auf das alte `name` für Robustheit während der Umstellung).
export function titleOf(p) {
    return p.title || p.name || "Unbenannt"
}

// Cover-URL: thumbnail, sonst der erste Screenshot. (Die alte resourcesUrl+"N.png"-Konvention entfällt.)
export function coverFor(p) {
    return p.thumbnail || (Array.isArray(p.screenshots) && p.screenshots[0]) || null
}

// Effektiver Preis in Cent (price hat Vorrang, sonst basePrice). 0 = kostenlos.
export function effectivePrice(p) {
    if (typeof p.price === "number") return p.price
    return p.basePrice || 0
}

// Cent → "Gratis" / "x,xx €".
export function formatPrice(cents) {
    if (!cents || cents <= 0) return "Gratis"
    return (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" })
}

export function ProductCard({ product, onClick }) {
    const cover = coverFor(product)
    const price = effectivePrice(product)
    return (
        <Card hover className="product-card" onClick={onClick}>
            <div className={`product-card__cover ${cover ? "" : "empty"}`}>
                {cover ? <img src={cover} alt={titleOf(product)} loading="lazy" /> : <i className="bi bi-controller" />}
            </div>
            <div className="product-card__body">
                <span className="product-card__cat">{product.category || "Spiel"}</span>
                <span className="product-card__title">{titleOf(product)}</span>
                {product.developerSlug && <span className="product-card__dev">{product.developerSlug}</span>}
                <div className="product-card__foot">
                    {product.owned
                        ? <Badge kind="free">In Bibliothek</Badge>
                        : product.comingSoon
                            ? <Badge kind="soon">Bald</Badge>
                            : price > 0
                                ? <Badge kind="demo">{formatPrice(price)}</Badge>
                                : <Badge kind="free">Gratis</Badge>}
                </div>
            </div>
        </Card>
    )
}
