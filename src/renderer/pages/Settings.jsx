import "./pages.css"
import { useEffect, useState } from "react"
import { get, send } from "../lib/api.js"
import { Button, Card, Input } from "../components/ui/index.jsx"
import { Section, LoadingState } from "../components/common.jsx"
import { useNotify } from "../lib/notifications.jsx"

function Toggle({ checked, onChange }) {
    return (
        <label className="switch">
            <input type="checkbox" checked={!!checked} onChange={e => onChange(e.target.checked)} />
            <span className="track" />
        </label>
    )
}

export default function Settings() {
    const [settings, setSettings] = useState(null)
    const [loading, setLoading] = useState(true)
    const notify = useNotify()

    useEffect(() => {
        get("/api/settings").then(setSettings).catch(() => setSettings(null)).finally(() => setLoading(false))
    }, [])

    const update = (patch) => setSettings(s => ({ ...s, ...patch }))

    async function persist(next) {
        const merged = { ...settings, ...next }
        setSettings(merged)
        try { await send("/api/settings", merged) }
        catch (err) { notify("Fehler", "Einstellung konnte nicht gespeichert werden: " + err, "error") }
    }

    async function pickPath() {
        try {
            const res = await get("/api/settings/open")
            const newPath = res?.path || res
            if (newPath && typeof newPath === "string" && settings.installationPath && newPath !== settings.installationPath) {
                await send("/api/settings/move", { oldInstallationPath: settings.installationPath, newInstallationPath: newPath })
                update({ installationPath: newPath })
                notify("Verschoben", "Installationsordner wurde geändert.", "success")
            }
        } catch (err) { notify("Fehler", String(err), "error") }
    }

    if (loading) return <div className="page"><LoadingState /></div>
    if (!settings) return <div className="page"><Section title="Einstellungen"><p>Einstellungen konnten nicht geladen werden.</p></Section></div>

    return (
        <div className="page">
            <Section title="Einstellungen" subtitle={settings.version ? `Launcher Version ${settings.version}` : null}>
                <Card pad>
                    <div className="form-grid">
                        <div className="form-row">
                            <label>Installationsordner</label>
                            <div style={{ display: "flex", gap: 10 }}>
                                <Input readOnly value={settings.installationPath || ""} />
                                <Button variant="ghost" onClick={pickPath}><i className="bi bi-folder2-open" /> Ändern</Button>
                            </div>
                            <span className="hint">Hier werden deine Spiele installiert.</span>
                        </div>

                        <div className="form-row form-row__inline">
                            <div><label>Bei Start anmelden</label><div className="hint">Login-Maske beim Öffnen anzeigen.</div></div>
                            <Toggle checked={settings.loginOnStartup} onChange={v => persist({ loginOnStartup: v })} />
                        </div>

                        <div className="form-row form-row__inline">
                            <div><label>Benachrichtigungen</label><div className="hint">In-App-Benachrichtigungen anzeigen.</div></div>
                            <Toggle checked={settings.notifications} onChange={v => persist({ notifications: v })} />
                        </div>

                        <div className="form-row form-row__inline">
                            <div><label>Desktop-Benachrichtigungen</label><div className="hint">Systembenachrichtigungen erlauben.</div></div>
                            <Toggle checked={settings.desktopNotifications} onChange={v => persist({ desktopNotifications: v })} />
                        </div>

                        <div className="form-row form-row__inline">
                            <div><label>Entwicklerkonsole</label><div className="hint">DevTools beim Start öffnen.</div></div>
                            <Toggle checked={settings.console} onChange={v => persist({ console: v })} />
                        </div>
                    </div>
                </Card>
            </Section>
        </div>
    )
}
