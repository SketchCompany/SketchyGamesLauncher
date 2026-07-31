// Übersetzt die Fehlercodes des OAuth-Flows in verständliche deutsche Meldungen.
// Vertrag: die API hängt bei einem Fehlschlag `?error=<code>&provider=<p>` an die Loopback-URL
// (siehe api/routes/v1/identity/oauth.js → redirectOAuthError). `oauthLoopback.js` reicht den Code
// roh weiter, bewertet wird er ausschließlich hier: alles außerhalb von MESSAGES fällt auf
// „oauth_failed" zurück, damit kein fremder Text aus der Callback-URL in die UI gelangen kann.
const PROVIDER_LABELS = { google: "Google", github: "GitHub", discord: "Discord" }

// {Provider} wird durch das Label ersetzt (Fallback: „dem Anbieter" bzw. „Der Anbieter").
const MESSAGES = {
	// --- von der API gemeldet ---
	email_exists: "Ein Nutzer mit dieser E-Mail existiert bereits. Melde dich mit deinem Passwort an und verknüpfe {Provider} in deinen Kontoeinstellungen.",
	username_exists: "Ein Nutzer mit diesem Benutzernamen existiert bereits. Melde dich mit deinem Passwort an und verknüpfe {Provider} in deinen Kontoeinstellungen.",
	no_email: "{Provider} hat uns keine bestätigte E-Mail-Adresse übermittelt. Bestätige deine E-Mail bei {Provider} und versuch es erneut.",
	access_denied: "Du hast die Anmeldung bei {Provider} abgebrochen.",
	provider_error: "{Provider} konnte die Anmeldung nicht abschließen. Bitte versuch es später erneut.",
	account_exists: "Dieses Konto existiert bereits. Melde dich mit deinem Passwort an.",
	account_create_failed: "Dein Konto konnte nicht angelegt werden. Bitte versuch es später erneut.",
	account_update_failed: "Deine Kontodaten konnten nicht gespeichert werden. Bitte versuch es später erneut.",
	lookup_failed: "Dein Konto konnte nicht geladen werden. Bitte versuch es später erneut.",
	oauth_failed: "Die Anmeldung bei {Provider} ist fehlgeschlagen. Bitte versuch es erneut.",
	// --- lokal im Launcher erzeugt (oauthLoopback.js) ---
	invalid_response: "Die Antwort von {Provider} war ungültig oder veraltet. Bitte starte die Anmeldung neu.",
	exchange_failed: "Die Anmeldung konnte nicht abgeschlossen werden — der Anmeldecode war abgelaufen. Bitte versuch es erneut.",
	timeout: "Zeitüberschreitung — die Anmeldung im Browser hat zu lange gedauert. Bitte versuch es erneut.",
	cancelled: "Die Anmeldung wurde abgebrochen.",
	unknown_provider: "Unbekannter Anbieter.",
}

// TODO: entfernen, sobald die API die Codes ausliefert (dann liefert `?error=` nie wieder Klartext).
// Solange die alte API läuft, kommt der englische Grund mit einem Tag wie „[google:1]" an — daraus
// lässt sich derselbe Code ableiten, damit der Launcher schon vor dem API-Deploy konkret meldet.
function legacyCode(raw) {
	if (/\[(google|github|discord):1\]/.test(raw)) return "email_exists"
	if (/\[(google|github|discord):2\]/.test(raw)) return "username_exists"
	return null
}

/**
 * Liefert die Nutzer-Meldung zu einem OAuth-Fehlercode.
 * @param {string} [code] Code aus der API bzw. aus oauthLoopback.js (auch Klartext der Alt-API).
 * @param {string} [provider] „google" | „github" | „discord" — für die {Provider}-Platzhalter.
 * @returns {string}
 */
function messageFor(code, provider) {
	const raw = String(code || "")
	// hasOwnProperty, damit "constructor"/"__proto__" nicht am Prototyp landen.
	const known = k => Object.prototype.hasOwnProperty.call(MESSAGES, k)
	const key = known(raw) ? raw : legacyCode(raw) || "oauth_failed"
	const label = Object.prototype.hasOwnProperty.call(PROVIDER_LABELS, provider) ? PROVIDER_LABELS[provider] : null
	// Ohne bekannten Anbieter greift der Dativ-Platzhalter („bei/von dem Anbieter"); steht er am
	// Satzanfang, braucht es den Nominativ („Der Anbieter konnte …").
	return MESSAGES[key]
		.replace(/\{Provider\}/g, label || "dem Anbieter")
		.replace(/^dem Anbieter/, "Der Anbieter")
}

module.exports = { messageFor, PROVIDER_LABELS }
