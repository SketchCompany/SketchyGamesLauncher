import { createContext, useContext, useCallback, useState, useRef } from "react"

const NotifyCtx = createContext(null)

// Replaces the old global notify()/notifyCb() helpers. Renders toasts bottom-right.
export function NotificationsProvider({ children }) {
    const [toasts, setToasts] = useState([])
    const idRef = useRef(0)

    const remove = useCallback((id) => {
        setToasts(t => t.filter(x => x.id !== id))
    }, [])

    const notify = useCallback((title, message, type = "note", duration = 8000, onClick) => {
        const id = ++idRef.current
        setToasts(t => [...t, { id, title, message, type, onClick }])
        if (duration > 0) setTimeout(() => remove(id), duration)
        return id
    }, [remove])

    return (
        <NotifyCtx.Provider value={notify}>
            {children}
            <div className="toast-stack">
                {toasts.map(t => (
                    <div
                        key={t.id}
                        className={`toast ${t.type} ${t.onClick ? "clickable" : ""}`}
                        onClick={() => { if (t.onClick) { t.onClick(); remove(t.id) } }}
                    >
                        <button className="toast__close" onClick={(e) => { e.stopPropagation(); remove(t.id) }} aria-label="Schließen">
                            <i className="bi bi-x-lg" />
                        </button>
                        <div className="toast__title">{t.title}</div>
                        <div className="toast__msg">{t.message}</div>
                    </div>
                ))}
            </div>
        </NotifyCtx.Provider>
    )
}

export function useNotify() {
    const ctx = useContext(NotifyCtx)
    if (!ctx) throw new Error("useNotify must be used within NotificationsProvider")
    return ctx
}
