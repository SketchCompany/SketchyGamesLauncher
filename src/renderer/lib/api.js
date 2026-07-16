// Thin fetch wrapper that mirrors the old jQuery app.js helpers (get/send/getAndCache).
// The local Express API (src/api.js) answers under /api and mostly responds with
// { status: 1|0, data }. By default we unwrap `.data`; pass raw=true for the envelope.

async function request(url, options) {
    const res = await fetch(url, options)
    const text = await res.text()
    let json
    try { json = text ? JSON.parse(text) : null }
    catch { return text }
    return json
}

export async function get(url, raw = false) {
    const json = await request(url, { method: "GET" })
    if (raw) return json
    return json && typeof json === "object" && "data" in json ? json.data : json
}

export async function send(url, data, raw = false) {
    const json = await request(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data ?? {}),
    })
    if (raw) return json
    return json && typeof json === "object" && "data" in json ? json.data : json
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
