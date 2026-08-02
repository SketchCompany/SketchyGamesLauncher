// Test des internen Client-Keys in src/apiBase.js (Header X-Client-Key == env CLIENT_KEY_LAUNCHER
// der API). Bisher gab es für dieses Modul keinen Test — apiHeaders() ist der einzige Durchlasspunkt
// für alle Aufrufe der zentralen API (src/functions.js get/send/graphql), ein Regressionsschutz hier
// deckt also automatisch jeden Aufrufer ab. Läuft mit `npm run test:unit`.
const { test } = require("node:test")
const assert = require("node:assert")

const MODULE_PATH = require.resolve("../src/apiBase")

/**
 * Lädt src/apiBase.js frisch, mit genau den übergebenen Env-Variablen gesetzt (alle anderen
 * bewusst auf "" statt gelöscht — apiBase.js lädt beim Require selbst `dotenv.config()`, das eine
 * FEHLENDE Variable aus einem eventuell vorhandenen echten `.env` nachladen würde und den Test von
 * lokalem Zustand abhängig machen könnte; "" ist für dotenv bereits "gesetzt" und bleibt unangetastet).
 */
function freshApiBase(env) {
	delete require.cache[MODULE_PATH]
	const keys = ["SKETCHY_LAUNCHER_KEY", "SKETCHY_CLIENT_KEY", "SKETCHY_API_BASE"]
	const prev = Object.fromEntries(keys.map((k) => [k, process.env[k]]))
	for (const k of keys) process.env[k] = ""
	Object.assign(process.env, env)
	try {
		return require("../src/apiBase")
	} finally {
		for (const k of keys) {
			if (prev[k] === undefined) delete process.env[k]
			else process.env[k] = prev[k]
		}
		delete require.cache[MODULE_PATH]
	}
}

test("apiHeaders setzt X-Client-Key, wenn SKETCHY_CLIENT_KEY gesetzt ist", () => {
	const { apiHeaders } = freshApiBase({ SKETCHY_CLIENT_KEY: "test-client-key" })
	assert.equal(apiHeaders()["X-Client-Key"], "test-client-key")
})

test("apiHeaders lässt X-Client-Key weg, wenn kein Schlüssel konfiguriert ist", () => {
	const { apiHeaders } = freshApiBase({})
	assert.equal("X-Client-Key" in apiHeaders(), false)
})

test("X-Client-Key ist unabhängig von X-Launcher-Key — beide können gleichzeitig gesetzt sein", () => {
	const { apiHeaders } = freshApiBase({ SKETCHY_LAUNCHER_KEY: "bot-bypass", SKETCHY_CLIENT_KEY: "client-proof" })
	const headers = apiHeaders()
	assert.equal(headers["X-Launcher-Key"], "bot-bypass")
	assert.equal(headers["X-Client-Key"], "client-proof")
})

test("apiHeaders trägt weiterhin Content-Type und Authorization wie vor der Änderung", () => {
	const { apiHeaders } = freshApiBase({ SKETCHY_CLIENT_KEY: "k" })
	const headers = apiHeaders({ token: "tok123" })
	assert.equal(headers["Content-Type"], "application/json")
	assert.equal(headers["Authorization"], "Bearer tok123")
})
