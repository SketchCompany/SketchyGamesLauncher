// Thin fetch wrapper that mirrors the old jQuery app.js helpers (get/send/getAndCache).
// The local Express API (src/api.js) answers under /api and mostly responds with
// { status: 1|0, data }. By default we unwrap `.data`; pass raw=true for the envelope.

/**
 * Typisierter Ladefehler, damit die UI die URSACHE benennen kann (offline, Server nicht
 * erreichbar, Serverfehler, Sitzung abgelaufen). `kind`:
 *  - "local"   → fetch selbst warf (lokaler Express-Server nicht erreichbar / echter Netzfehler)
 *  - "http"    → HTTP-Status nicht ok (4xx/5xx)
 *  - "server"  → Envelope meldet `status:0` (Remote-Backend hat einen Fehler geliefert)
 *  - "session" → Sitzung abgelaufen (Remote-401); der Redirect läuft über das Window-Event
 */
export class AppError extends Error {
    constructor({ kind, httpStatus = null, serverStatus = null, code = null, sessionExpired = false, message } = {}) {
        super(message || kind || "AppError")
        this.name = "AppError"
        this.kind = kind
        this.httpStatus = httpStatus
        this.serverStatus = serverStatus
        this.code = code
        this.sessionExpired = sessionExpired
    }
}

async function request(url, options) {
    let res
    try {
        res = await fetch(url, options)
    } catch {
        // fetch wirft nur, wenn der lokale Express-Server nicht erreichbar ist.
        throw new AppError({ kind: "local", message: "Lokaler Dienst nicht erreichbar." })
    }
    const text = await res.text()
    let json
    try { json = text ? JSON.parse(text) : null }
    catch { json = text }
    // Zentrale Session-Ablauf-Erkennung: die lokale API setzt bei einem Remote-401
    // `sessionExpired: true` und hat die Session bereits verworfen. Ein globales Event
    // lässt den SessionGuard (lib/session.jsx) zur Login-Seite umleiten.
    if (json && typeof json === "object" && json.sessionExpired) {
        window.dispatchEvent(new Event("sgl:session-expired"))
    }
    return { ok: res.ok, httpStatus: res.status, json }
}

// „Alt"-Verhalten: Envelope entpacken (`.data`) bzw. bei raw den vollen Envelope liefern.
// Wirft NICHT bei status:0 — für send()/Mutationen, deren Aufrufer den Status selbst prüfen
// (z.B. Login, das bei status:0 eine eigene Meldung aus data zieht).
function legacyUnwrap({ json }, raw) {
    if (raw) return json
    return json && typeof json === "object" && "data" in json ? json.data : json
}

// Lade-Verhalten für get(): wirft einen typisierten AppError, wenn das Laden fehlschlägt,
// damit die UI die Ursache benennen kann. raw=true behält den Envelope (kein Wurf).
function unwrapOrThrow({ ok, httpStatus, json }, raw) {
    if (raw) return json
    if (json && typeof json === "object" && json.sessionExpired) {
        throw new AppError({ kind: "session", httpStatus, sessionExpired: true, message: "Sitzung abgelaufen." })
    }
    if (!ok) {
        throw new AppError({ kind: "http", httpStatus, message: `HTTP ${httpStatus}` })
    }
    if (json && typeof json === "object" && json.status === 0) {
        throw new AppError({
            kind: "server",
            httpStatus,
            serverStatus: 0,
            code: json.code ?? null,
            message: typeof json.data === "string" ? json.data : "Serverfehler.",
        })
    }
    return json && typeof json === "object" && "data" in json ? json.data : json
}

export async function get(url, raw = false) {
    return unwrapOrThrow(await request(url, { method: "GET" }), raw)
}

export async function send(url, data, raw = false) {
    return legacyUnwrap(await request(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data ?? {}),
    }), raw)
}

// Verlangt einen erfolgreichen Server-Status (status === 1) und wirft sonst einen typisierten
// AppError — für Konto-/Sicherheits-Loads & -Mutationen, deren Aufrufer den Fehler cause-abhängig
// melden wollen. Liefert bei Erfolg json.data. (send() bleibt bewusst „weich" für Login & Co.)
function checked({ ok, httpStatus, json }) {
    if (json && typeof json === "object" && json.sessionExpired) {
        throw new AppError({ kind: "session", httpStatus, sessionExpired: true, message: "Sitzung abgelaufen." })
    }
    if (!ok) {
        throw new AppError({ kind: "http", httpStatus, message: `HTTP ${httpStatus}` })
    }
    if (!json || typeof json !== "object" || json.status !== 1) {
        throw new AppError({
            kind: "server",
            httpStatus,
            serverStatus: json?.status ?? 0,
            code: json?.code ?? null,
            message: typeof json?.data === "string" ? json.data : "Fehler",
        })
    }
    return json.data
}

export async function getChecked(url) {
    return checked(await request(url, { method: "GET" }))
}

export async function sendChecked(url, data) {
    return checked(await request(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data ?? {}),
    }))
}

export async function getAndCache(url, raw = false) {
    return get("/api/request-and-cache?url=" + encodeURIComponent(url), raw)
}

// Connection status: 0 offline / 1 internet only / 2 internet + server.
export async function getConnection() {
    try { return await get("/api/connection") }
    catch { return 0 }
}

// Open an external link via the launcher (never window.open to arbitrary URLs).
export async function openExternal(href) {
    return send("/api/browser", { href })
}
