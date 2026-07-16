import "./auth.css"
import { useState, useRef, useEffect } from "react"
import { Link, useNavigate, useLocation } from "react-router-dom"
import { Button } from "../components/ui/index.jsx"
import { send } from "../lib/api.js"
import { useNotify } from "../lib/notifications.jsx"

export default function Verify() {
    const [code, setCode] = useState(["", "", "", "", "", ""])
    const [loading, setLoading] = useState(false)
    const refs = useRef([])
    const navigate = useNavigate()
    const notify = useNotify()
    const { state } = useLocation()
    const account = state || {}

    useEffect(() => {
        // Bestätigungs-E-Mail anfordern (v1: E-Mail muss VOR der Kontoerstellung verifiziert sein).
        if (account.email) send("/api/account/verify", { user: account.user, email: account.email }).catch(() => {})
    }, []) // eslint-disable-line

    function setDigit(i, v) {
        if (!/^\d?$/.test(v)) return
        setCode(c => { const n = [...c]; n[i] = v; return n })
        if (v && i < 5) refs.current[i + 1]?.focus()
    }

    async function submit(e) {
        e?.preventDefault()
        const joined = code.join("")
        if (joined.length < 6) { notify("Fehler", "Bitte gib den 6-stelligen Code ein.", "error"); return }
        setLoading(true)
        try {
            const res = await send("/api/account/signup", { ...account, code: joined })
            if (res && (res.correct ?? true)) {
                notify("Account erstellt", "Du kannst dich jetzt anmelden.", "success")
                navigate("/login")
            } else {
                notify("Fehler", "Der Code ist ungültig oder abgelaufen.", "error")
            }
        } catch (err) {
            notify("Fehler", "Verifizierung fehlgeschlagen: " + err, "error")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="auth-screen">
            <div className="auth-card">
                <div className="auth-brand">
                    <span className="logo-dot" />
                    <b>Sketchy Games</b>
                </div>
                <h1>E-Mail bestätigen</h1>
                <p>Gib den 6-stelligen Code ein, den wir an {account.email || "deine E-Mail"} gesendet haben.</p>
                <form className="auth-form" onSubmit={submit}>
                    <div className="code-inputs">
                        {code.map((d, i) => (
                            <input
                                key={i}
                                ref={el => refs.current[i] = el}
                                value={d}
                                inputMode="numeric"
                                maxLength={1}
                                onChange={e => setDigit(i, e.target.value)}
                                onKeyDown={e => { if (e.key === "Backspace" && !d && i > 0) refs.current[i - 1]?.focus() }}
                            />
                        ))}
                    </div>
                    <Button type="submit" variant="primary" disabled={loading}>
                        {loading ? "Prüfen…" : "Bestätigen"}
                    </Button>
                </form>
                <div className="auth-foot">
                    Kein Code erhalten? <Link to="/signup">Zurück zur Registrierung</Link>
                </div>
            </div>
        </div>
    )
}
