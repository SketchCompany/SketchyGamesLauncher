import { createContext, useContext, useCallback, useState } from "react"
import { Button } from "../components/ui/index.jsx"

const DialogCtx = createContext(null)

// Replaces createDialog()/removeDialog(). showDialog returns a promise that resolves
// with the index of the chosen action (or -1 if dismissed via backdrop/escape).
export function DialogProvider({ children }) {
    const [dialog, setDialog] = useState(null)

    const close = useCallback((result) => {
        setDialog(d => {
            if (d) d._resolve(result)
            return null
        })
    }, [])

    const showDialog = useCallback(({ title, message, actions = [{ label: "OK" }], body }) => {
        return new Promise(resolve => {
            setDialog({ title, message, actions, body, _resolve: resolve })
        })
    }, [])

    const confirm = useCallback((title, message) => {
        return showDialog({
            title, message,
            actions: [
                { label: "Abbrechen", variant: "ghost" },
                { label: "Bestätigen", variant: "primary" },
            ],
        }).then(i => i === 1)
    }, [showDialog])

    return (
        <DialogCtx.Provider value={{ showDialog, confirm, close }}>
            {children}
            {dialog && (
                <div className="dialog-backdrop" onClick={() => close(-1)}>
                    <div className="dialog-content" onClick={e => e.stopPropagation()}>
                        {dialog.title && <h3>{dialog.title}</h3>}
                        {dialog.message && <p>{dialog.message}</p>}
                        {dialog.body}
                        <div className="dialog-actions">
                            {dialog.actions.map((a, i) => (
                                <Button key={i} variant={a.variant || "default"} onClick={() => close(i)}>
                                    {a.label}
                                </Button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </DialogCtx.Provider>
    )
}

export function useDialog() {
    const ctx = useContext(DialogCtx)
    if (!ctx) throw new Error("useDialog must be used within DialogProvider")
    return ctx
}
