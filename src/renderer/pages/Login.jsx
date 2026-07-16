import "./auth.css"
import { useState, useRef } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Button, Input, PasswordInput } from "../components/ui/index.jsx"
import { send } from "../lib/api.js"
import { useNotify } from "../lib/notifications.jsx"

export default function Login() {
    const [userOrEmail, setUserOrEmail] = useState("")
    const [password, setPassword] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    // Schritt-Umschaltung: "creds" (Benutzer/Passwort) → optional "totp" (2FA-Code).
    const [step, setStep] = useState("creds")
    const [challengeToken, setChallengeToken] = useState("")
    const [code, setCode] = useState(["", "", "", "", "", ""])
    const refs = useRef([])
    const navigate = useNavigate()
    const notify = useNotify()

    async function submitCreds(e) {
        e.preventDefault()
        setError("")
        if (!userOrEmail || !password) { setError("Bitte fülle alle Felder aus."); return }
        setLoading(true)
        try {
            // BFF /account/login (send entpackt .data): { correct, data } ODER { correct, twoFactorRequired, challengeToken }.
            const res = await send("/api/account/login", { userOrEmail, password })
            if (res && res.twoFactorRequired) {
                setChallengeToken(res.challengeToken)
                setStep("totp")
                setTimeout(() => refs.current[0]?.focus(), 50)
            } else if (res && res.correct) {
                notify("Angemeldet", "Willkommen zurück!", "success", 4000)
                navigate("/")
            } else {
                setError(typeof res?.data === "string" ? res.data : "Anmeldedaten sind falsch.")
            }
        } catch (err) {
            setError("Anmeldung fehlgeschlagen: " + err)
        } finally {
            setLoading(false)
        }
    }

    function setDigit(i, v) {
        if (!/^\d?$/.test(v)) return
        setCode(c => { const n = [...c]; n[i] = v; return n })
        if (v && i < 5) refs.current[i + 1]?.focus()
    }

    async function submitTotp(e) {
        e.preventDefault()
        setError("")
        const joined = code.join("")
        if (joined.length < 6) { setError("Bitte gib den 6-stelligen Code ein."); return }
        setLoading(true)
        try {
            const res = await send("/api/account/login/2fa", { challengeToken, code: joined })
            if (res && res.correct) {
                notify("Angemeldet", "Willkommen zurück!", "success", 4000)
                navigate("/")
            } else {
                setError(typeof res?.data === "string" ? res.data : "Der 2FA-Code ist falsch.")
                setCode(["", "", "", "", "", ""])
                setTimeout(() => refs.current[0]?.focus(), 50)
            }
        } catch (err) {
            setError("2FA fehlgeschlagen: " + err)
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
                {step === "creds" ? (
                    <>
                        <h1>Anmelden</h1>
                        <p>Melde dich mit deinem Sketch Company Account an.</p>
                        <form className="auth-form" onSubmit={submitCreds}>
                            <Input
                                label="Benutzername / E-Mail"
                                placeholder="Benutzername oder E-Mail"
                                value={userOrEmail}
                                onChange={e => setUserOrEmail(e.target.value)}
                                invalid={!!error}
                            />
                            <PasswordInput
                                label="Passwort"
                                placeholder="Passwort"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                invalid={!!error}
                                error={error}
                            />
                            <Button type="submit" variant="primary" disabled={loading}>
                                {loading ? "Anmelden…" : "Anmelden"}
                            </Button>
                        </form>
                        <div className="auth-foot">
                            Noch keinen Account? <Link to="/signup">Jetzt registrieren</Link>
                        </div>
                    </>
                ) : (
                    <>
                        <h1>Zwei-Faktor-Authentifizierung</h1>
                        <p>Gib den 6-stelligen Code aus deiner Authenticator-App ein.</p>
                        <form className="auth-form" onSubmit={submitTotp}>
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
                            {error ? <div className="auth-error">{error}</div> : null}
                            <Button type="submit" variant="primary" disabled={loading}>
                                {loading ? "Prüfen…" : "Bestätigen"}
                            </Button>
                        </form>
                        <div className="auth-foot">
                            <a onClick={() => { setStep("creds"); setError(""); setCode(["", "", "", "", "", ""]) }} style={{ cursor: "pointer" }}>Zurück zur Anmeldung</a>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
