import "./shell.css"
import { useEffect, useState } from "react"
import { Outlet, NavLink, useLocation, useNavigate, Link } from "react-router-dom"
import { get } from "../../lib/api.js"

const MENU = [
    { to: "/", label: "Startseite", icon: "bi-house" },
    { to: "/news", label: "News", icon: "bi-newspaper" },
    { to: "/notes", label: "Patch Notes", icon: "bi-card-list" },
    { to: "/library", label: "Bibliothek", icon: "bi-controller" },
    { to: "/store", label: "Store", icon: "bi-bag" },
    { to: "/downloads", label: "Downloads", icon: "bi-download" },
    { to: "/account", label: "Account", icon: "bi-person-circle" },
    { to: "/settings", label: "Einstellungen", icon: "bi-gear" },
]

const LABELS = {
    "": "Startseite", news: "News", notes: "Patch Notes", library: "Bibliothek",
    store: "Store", downloads: "Downloads", account: "Account", settings: "Einstellungen",
}

function Header({ onMenu, onBell, unread }) {
    const [scrolling, setScrolling] = useState(false)
    useEffect(() => {
        const onScroll = () => setScrolling(window.scrollY > 30)
        window.addEventListener("scroll", onScroll)
        return () => window.removeEventListener("scroll", onScroll)
    }, [])
    return (
        <header className={`app-header ${scrolling ? "scrolling" : ""}`}>
            <div className="left">
                <button className="header-icon-btn" onClick={onMenu} aria-label="Menü">
                    <i className="bi bi-list" />
                </button>
                <button className="header-icon-btn" onClick={onBell} aria-label="Benachrichtigungen">
                    <i className="bi bi-bell" />
                    {unread > 0 && <span className="notif-badge">{unread > 9 ? "9+" : unread}</span>}
                </button>
            </div>
            <Link to="/" className="header-brand">
                <span className="logo-dot" />
                <span className="brand-text">Sketchy Games Launcher</span>
                <span className="brand-beta">BETA</span>
            </Link>
            <div className="right" />
        </header>
    )
}

function Offcanvas({ open, onClose }) {
    const { pathname } = useLocation()
    if (!open) return null
    const current = LABELS[pathname.split("/")[1] || ""] || "Menü"
    return (
        <>
            <div className="offcanvas-backdrop" onClick={onClose} />
            <aside className="offcanvas">
                <div className="offcanvas__head">
                    <h3>{current}</h3>
                    <button className="header-icon-btn" onClick={onClose} aria-label="Schließen">
                        <i className="bi bi-x-lg" />
                    </button>
                </div>
                <nav>
                    {MENU.map(m => (
                        <NavLink key={m.to} to={m.to} end={m.to === "/"} onClick={onClose}
                            className={({ isActive }) => isActive ? "active" : ""}>
                            <i className={`bi ${m.icon}`} />
                            {m.label}
                        </NavLink>
                    ))}
                </nav>
            </aside>
        </>
    )
}

function Breadcrumb() {
    const { pathname } = useLocation()
    const navigate = useNavigate()
    const parts = pathname.split("/").filter(Boolean)
    return (
        <div className="breadcrumb">
            <div className="breadcrumb__nav">
                <button onClick={() => navigate(-1)} aria-label="Zurück"><i className="bi bi-arrow-left" /></button>
                <button onClick={() => navigate(1)} aria-label="Vor"><i className="bi bi-arrow-right" /></button>
            </div>
            <ol>
                <li><Link to="/">Start</Link></li>
                {parts.map((p, i) => {
                    const to = "/" + parts.slice(0, i + 1).join("/")
                    const label = LABELS[p] || decodeURIComponent(p)
                    return <li key={to}><Link to={to}>{label}</Link></li>
                })}
            </ol>
        </div>
    )
}

function NotificationsCenter({ open, onClose, items, onClear }) {
    if (!open) return null
    return (
        <div className="notif-center">
            <div className="notif-center__head">
                <h4>Benachrichtigungen</h4>
                <button className="header-icon-btn" onClick={onClear} aria-label="Alle löschen">
                    <i className="bi bi-trash" />
                </button>
            </div>
            {(!items || items.length === 0)
                ? <div className="notif-center__empty">Keine Benachrichtigungen</div>
                : items.map((n, i) => (
                    <div className="notif-center__item" key={i}>
                        <div className="t">{n.title}</div>
                        <div className="m">{n.message}</div>
                    </div>
                ))}
        </div>
    )
}

export default function AppShell() {
    const [menuOpen, setMenuOpen] = useState(false)
    const [bellOpen, setBellOpen] = useState(false)
    const [notifs, setNotifs] = useState([])

    useEffect(() => {
        get("/api/notifications").then(d => { if (Array.isArray(d)) setNotifs(d) }).catch(() => {})
    }, [])

    return (
        <div className="app">
            <Header
                onMenu={() => setMenuOpen(true)}
                onBell={() => setBellOpen(o => !o)}
                unread={notifs.length}
            />
            <Offcanvas open={menuOpen} onClose={() => setMenuOpen(false)} />
            <NotificationsCenter
                open={bellOpen}
                onClose={() => setBellOpen(false)}
                items={notifs}
                onClear={() => { setNotifs([]); setBellOpen(false) }}
            />
            <Breadcrumb />
            <main>
                <Outlet />
            </main>
        </div>
    )
}
