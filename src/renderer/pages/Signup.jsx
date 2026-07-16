import "./auth.css"
import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Button, Input, PasswordInput } from "../components/ui/index.jsx"
import { useNotify } from "../lib/notifications.jsx"

function validate({ user, email, password, confirm }) {
    const e = {}
    if (user.length < 3) e.user = "Mindestens 3 Zeichen."
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) e.email = "Ungültige E-Mail."
    if (password.length < 8) e.password = "Mindestens 8 Zeichen."
    if (confirm !== password) e.confirm = "Passwörter stimmen nicht überein."
    return e
}

export default function Signup() {
    const [form, setForm] = useState({ user: "", email: "", password: "", confirm: "" })
    const [errors, setErrors] = useState({})
    const navigate = useNavigate()
    const notify = useNotify()
    const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

    function submit(e) {
        e.preventDefault()
        const errs = validate(form)
        setErrors(errs)
        if (Object.keys(errs).length > 0) return
        // Email verification step handles the actual account creation.
        notify("Bestätigung", "Wir senden dir einen Code zur Verifizierung.", "note", 5000)
        navigate("/verify", { state: { user: form.user, email: form.email, password: form.password } })
    }

    return (
        <div className="auth-screen">
            <div className="auth-card">
                <div className="auth-brand">
                    <span className="logo-dot" />
                    <b>Sketchy Games</b>
                </div>
                <h1>Registrieren</h1>
                <p>Erstelle deinen kostenlosen Sketch Company Account.</p>
                <form className="auth-form" onSubmit={submit}>
                    <Input label="Benutzername" placeholder="Benutzername" value={form.user}
                        onChange={set("user")} invalid={!!errors.user} error={errors.user} />
                    <Input label="E-Mail" placeholder="name@beispiel.de" value={form.email}
                        onChange={set("email")} invalid={!!errors.email} error={errors.email} />
                    <PasswordInput label="Passwort" placeholder="Passwort" value={form.password}
                        onChange={set("password")} invalid={!!errors.password} error={errors.password} />
                    <PasswordInput label="Passwort bestätigen" placeholder="Passwort wiederholen" value={form.confirm}
                        onChange={set("confirm")} invalid={!!errors.confirm} error={errors.confirm} />
                    <Button type="submit" variant="primary">Weiter</Button>
                </form>
                <div className="auth-foot">
                    Bereits registriert? <Link to="/login">Anmelden</Link>
                </div>
            </div>
        </div>
    )
}
