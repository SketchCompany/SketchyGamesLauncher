// Desktop-OAuth über den Systembrowser (RFC 8252 Loopback). Öffnet den Anbieter im Standard-Browser,
// fängt den Rückruf über einen kurzlebigen HTTP-Server an 127.0.0.1:<ephemerer Port> ab, tauscht den
// Einmal-Code gegen den Session-Token (/v1/auth/oauth/exchange) und gibt ihn zurück. Kein
// Custom-Protocol, kein eingebetteter WebView. 127.0.0.1-Redirects sind serverseitig ge-whitelistet.
const http = require("http")
const crypto = require("crypto")
const func = require("./functions")
const { apiUrl } = require("./apiBase")

const PROVIDERS = ["google", "github", "discord"]
// Unter Node's http requestTimeout-Default (5 min) bleiben, damit unser Handler zuerst antwortet.
const TIMEOUT_MS = 4 * 60 * 1000

// Fehler mit Ursachen-Code: `oauthCode` wird von api.js über oauthErrors.messageFor() in eine
// deutsche Nutzer-Meldung übersetzt. Die Message bleibt der technische Grund (nur fürs Log).
class OAuthError extends Error {
	constructor(code, detail) {
		super(detail || code)
		this.name = "OAuthError"
		this.oauthCode = code
	}
}

// Abbruch-Hebel für den gerade laufenden Flow (nur einer gleichzeitig, UI erzwingt das).
// Wird von `cancel()` aufgerufen, damit der Nutzer nicht bis zum Timeout warten muss,
// falls der Browser-Tab ohne Rückruf geschlossen wird.
let activeCancel = null

function resultPage(success) {
	const title = success ? "Erfolgreich angemeldet" : "Anmeldung fehlgeschlagen"
	const body = success
		? "Du kannst dieses Fenster schließen und zum Sketchy Games Launcher zurückkehren."
		// Der Grund steht bewusst nur im Launcher (dort wartet der Toast, bis das Fenster wieder
		// vorne ist) — er soll nicht an einem fremden Bildschirm im Browser stehen bleiben.
		: "Kehre zum Sketchy Games Launcher zurück — dort steht, woran es lag."
	return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>html,body{height:100%;margin:0}body{display:grid;place-items:center;background:#0d0f16;color:#e8ecf4;font-family:system-ui,sans-serif}
.card{max-width:420px;padding:32px;text-align:center}.card h1{margin:0 0 8px;font-size:20px;color:${success ? "#1cf58a" : "#ff5470"}}
.card p{margin:0;color:#9aa4b8;font-size:14px;line-height:1.5}</style></head>
<body><div class="card"><h1>${title}</h1><p>${body}</p></div></body></html>`
}

/**
 * Startet den OAuth-Flow für `provider` und löst mit dem Session-Token auf (oder rejectet bei
 * Abbruch/Timeout/Fehler). `sessionMetaData` wird der API als Query-Param mitgegeben.
 */
function startOAuth(provider, sessionMetaData) {
	return new Promise((resolve, reject) => {
		if (!PROVIDERS.includes(provider)) return reject(new OAuthError("unknown_provider", `Unbekannter Anbieter: ${provider}`))
		const state = crypto.randomBytes(16).toString("hex")
		let settled = false
		let timer = null

		const server = http.createServer(async (req, res) => {
			try {
				const url = new URL(req.url, "http://127.0.0.1")
				if (url.pathname !== "/callback") { res.writeHead(404); res.end(); return }
				const code = url.searchParams.get("code")
				const stateOk = url.searchParams.get("state") === state
				const errParam = url.searchParams.get("error")
				const success = !!code && stateOk && !errParam
				res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
				res.end(resultPage(success))
				if (settled) return
				// `errParam` trägt den Ursachen-Code der API (bei der Alt-API noch englischen
				// Klartext). Hier wird er nur durchgereicht — geprüft wird er gegen die Whitelist
				// in oauthErrors.js, damit nichts Fremdes aus der URL in die UI gelangt.
				if (!success) {
					if (errParam) console.warn("OAuth-Fehler vom Anbieter:", errParam)
					// Ohne passenden `state` gehört der Rückruf nicht zu diesem Flow (veralteter Tab oder
					// untergeschobener Aufruf) — dann zählt auch ein mitgeschicktes `error` nicht.
					if (!stateOk) return finish(reject, new OAuthError("invalid_response", "state stimmt nicht überein."))
					return finish(reject, errParam
						? new OAuthError(errParam, `Anbieter meldete: ${errParam}`)
						: new OAuthError("invalid_response", "Kein Code im Rückruf."))
				}
				// Einmal-Code gegen den Session-Token tauschen (serverseitig single-use, 60s TTL).
				// Netzfehler hier zählen ebenfalls als „Austausch fehlgeschlagen" — der Browser-Teil
				// war ja schon erfolgreich.
				const exchanged = await func.send("/v1/auth/oauth/exchange", { code })
					.catch(err => { throw new OAuthError("exchange_failed", `Token-Austausch fehlgeschlagen: ${err && err.message}`) })
				const token = exchanged && (exchanged.token || (exchanged.data && exchanged.data.token))
				if (!token) return finish(reject, new OAuthError("exchange_failed", "Token-Austausch lieferte keinen Token."))
				finish(resolve, token)
			} catch (err) { finish(reject, err) }
		})

		function finish(fn, arg) {
			if (settled) return
			settled = true
			activeCancel = null
			if (timer) clearTimeout(timer)
			try { server.close() } catch (e) { /* noop */ }
			fn(arg)
		}
		// Von außen abbrechbar machen (z.B. „Abbrechen"-Button im Launcher).
		activeCancel = () => finish(reject, new OAuthError("cancelled", "Vom Nutzer abgebrochen."))

		server.on("error", err => finish(reject, new OAuthError("oauth_failed", `Loopback-Server: ${err && err.message}`)))
		server.listen(0, "127.0.0.1", () => {
			const port = server.address().port
			const redirect = `http://127.0.0.1:${port}/callback?state=${state}`
			const authUrl = apiUrl(`/v1/auth/login/${provider}`)
				+ `?redirect=${encodeURIComponent(redirect)}`
				+ `&sessionMetaData=${encodeURIComponent(JSON.stringify(sessionMetaData || {}))}`
			timer = setTimeout(() => finish(reject, new OAuthError("timeout", `Kein Rückruf innerhalb von ${TIMEOUT_MS} ms.`)), TIMEOUT_MS)
			Promise.resolve(func.openExternal(authUrl))
				.catch(err => finish(reject, new OAuthError("oauth_failed", `Browser konnte nicht geöffnet werden: ${err && err.message}`)))
		})
	})
}

// Bricht den laufenden OAuth-Flow ab (No-op, wenn keiner läuft).
function cancel() {
	if (activeCancel) activeCancel()
}

module.exports = { startOAuth, cancel, PROVIDERS, OAuthError }
