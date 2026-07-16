import "./ui.css"
import { useState } from "react"

export function Button({ variant = "default", size, className = "", as, ...props }) {
    const cls = [
        "btn",
        variant === "primary" && "btn--primary",
        variant === "ghost" && "btn--ghost",
        variant === "magenta" && "btn--magenta",
        variant === "icon" && "btn--icon",
        size === "sm" && "btn--sm",
        className,
    ].filter(Boolean).join(" ")
    const Comp = as || "button"
    return <Comp className={cls} {...props} />
}

export function Card({ hover = false, pad = false, className = "", as = "div", ...props }) {
    const Comp = as
    const cls = ["card", hover && "card--hover", pad && "card--pad", className].filter(Boolean).join(" ")
    return <Comp className={cls} {...props} />
}

export function Badge({ kind, className = "", children }) {
    const cls = ["badge", kind && `badge--${kind}`, className].filter(Boolean).join(" ")
    return <span className={cls}>{children}</span>
}

export function Spinner({ className = "" }) {
    return <div className={`spinner ${className}`} role="status" aria-label="Lädt" />
}

export function Input({ label, error, invalid, className = "", ...props }) {
    return (
        <div className="input-wrap">
            {label && <label>{label}</label>}
            <input className={`input ${invalid ? "input--invalid" : ""} ${className}`} {...props} />
            {error !== undefined && <span className="input-error">{error}</span>}
        </div>
    )
}

export function PasswordInput({ label, error, invalid, ...props }) {
    const [show, setShow] = useState(false)
    return (
        <div className="input-wrap">
            {label && <label>{label}</label>}
            <span className="input-viewable">
                <input
                    className={`input ${invalid ? "input--invalid" : ""}`}
                    type={show ? "text" : "password"}
                    {...props}
                />
                <button type="button" onClick={() => setShow(s => !s)} aria-label="Passwort anzeigen">
                    <i className={`bi ${show ? "bi-eye-slash" : "bi-eye"}`} />
                </button>
            </span>
            {error !== undefined && <span className="input-error">{error}</span>}
        </div>
    )
}
