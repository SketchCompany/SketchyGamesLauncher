import "./pages.css"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { get, send } from "../lib/api.js"
import { Button, Card, Input, PasswordInput } from "../components/ui/index.jsx"
import { Section, LoadingState } from "../components/common.jsx"
import { useNotify } from "../lib/notifications.jsx"
import { useDialog } from "../lib/dialog.jsx"

export default function Account() {
    const [account, setAccount] = useState(null)
    const [loading, setLoading] = useState(true)
    const [user, setUser] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [saving, setSaving] = useState(false)
    const notify = useNotify()
    const { confirm } = useDialog()
    const navigate = useNavigate()

    useEffect(() => {
        get("/api/account", true).then(res => {
            const d = res?.data || res
            setAccount(d)
            setUser(d?.user || "")
            setEmail(d?.email || "")
        }).catch(() => setAccount(null)).finally(() => setLoading(false))
    }, [])

    async function save() {
        setSaving(true)
        try {
            const payload = { user, email }
            if (password) payload.password = password
            await send("/api/account/update", payload, true)
            notify("Gespeichert", "Deine Account-Daten wurden aktualisiert.", "success")
            setPassword("")
        } catch (err) { notify("Fehler", String(err), "error") }
        finally { setSaving(false) }
    }

    async function logout() {
        if (!await confirm("Abmelden?", "Möchtest du dich wirklich abmelden?")) return
        try { await get("/api/account/logout") } catch { /* noop */ }
        navigate("/login")
    }

    if (loading) return <div className="page"><LoadingState /></div>

    let purchases = []
    try { purchases = account?.games ? (typeof account.games === "string" ? JSON.parse(account.games) : account.games) : [] }
    catch { purchases = [] }

    return (
        <div className="page">
            <Section title="Account" subtitle={account?.user ? `Angemeldet als ${account.user}` : "Nicht angemeldet"}>
                <Card pad>
                    <div className="form-grid">
                        <div className="form-row"><Input label="Benutzername" value={user} onChange={e => setUser(e.target.value)} /></div>
                        <div className="form-row"><Input label="E-Mail" value={email} onChange={e => setEmail(e.target.value)} /></div>
                        <div className="form-row"><PasswordInput label="Neues Passwort (optional)" placeholder="Leer lassen, um nichts zu ändern" value={password} onChange={e => setPassword(e.target.value)} /></div>
                        <div style={{ display: "flex", gap: 10 }}>
                            <Button variant="primary" onClick={save} disabled={saving}>{saving ? "Speichern…" : "Speichern"}</Button>
                            <Button variant="ghost" onClick={logout}><i className="bi bi-box-arrow-right" /> Abmelden</Button>
                        </div>
                    </div>
                </Card>
            </Section>

            {purchases.length > 0 && (
                <Section title="Käufe">
                    {purchases.map((p, i) => (
                        <div className="accordion-item" key={i}>
                            <div className="accordion-head" style={{ cursor: "default" }}>
                                <span>{p.name || p}</span>
                                {p.date && <span style={{ color: "var(--text-muted)", fontWeight: 400, fontSize: 13 }}>{p.date}</span>}
                            </div>
                        </div>
                    ))}
                </Section>
            )}
        </div>
    )
}
