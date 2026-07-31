import { useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { send, openExternal } from "../lib/api.js";
import { useNotify } from "../lib/notifications.jsx";
import { useOffline } from "../lib/offline.jsx";
import { notifySessionChanged } from "../lib/sessionEvents.js";
import AuthShell, {
  authInputCls,
  authErrorInputCls,
  authLinkCls,
  CodeInputs,
} from "../components/AuthShell.jsx";
import OAuthButtons from "../components/OAuthButtons.jsx";

export default function Login() {
  const [userOrEmail, setUserOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Schritt-Umschaltung: "creds" (Benutzer/Passwort) → optional "totp" (2FA-Code)
  // → optional "leak" (Passwort steht in einem Datenleck, muss ersetzt werden).
  const [step, setStep] = useState("creds");
  const [challengeToken, setChallengeToken] = useState("");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [useBackup, setUseBackup] = useState(false); // Backup-Code statt Authenticator-Code
  const [backupCode, setBackupCode] = useState("");
  // Wiederherstellung nach geleakten Zugangsdaten
  const [leak, setLeak] = useState(null); // { recoveryToken, verification, email }
  const [leakCode, setLeakCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const refs = useRef([]);
  const navigate = useNavigate();
  const notify = useNotify();
  const { setOffline } = useOffline();

  // „Offline spielen": Offlinemodus aktivieren und ohne Anmeldung in die Bibliothek.
  async function playOffline() {
    await setOffline(true);
    navigate("/library", { replace: true });
  }

  async function submitCreds(e) {
    e.preventDefault();
    setError("");
    if (!userOrEmail || !password) {
      setError("Bitte fülle alle Felder aus.");
      return;
    }
    setLoading(true);
    try {
      const res = await send("/api/account/login", { userOrEmail, password });
      if (res && res.credentialLeak) {
        startLeakRecovery(res);
      } else if (res && res.twoFactorRequired) {
        setChallengeToken(res.challengeToken);
        setStep("totp");
        setTimeout(() => refs.current[0]?.focus(), 50);
      } else if (res && res.correct) {
        await setOffline(false); // Anmeldung beendet den Offlinemodus.
        notifySessionChanged(); // Store/Wunschliste des Vorgängers verwerfen (owned-Flags!).
        notify("Angemeldet", "Willkommen zurück!", "success", 4000);
        navigate("/", { replace: true });
      } else {
        setError(
          typeof res?.data === "string"
            ? res.data
            : "Anmeldedaten sind falsch.",
        );
      }
    } catch (err) {
      setError("Anmeldung fehlgeschlagen. Bitte versuch es erneut.");
    } finally {
      setLoading(false);
    }
  }

  function setDigit(i, v) {
    if (!/^\d?$/.test(v)) return;
    setCode((c) => {
      const n = [...c];
      n[i] = v;
      return n;
    });
    if (v && i < 5) refs.current[i + 1]?.focus();
  }

  async function submitTotp(e) {
    e.preventDefault();
    setError("");
    // Entweder der 6-stellige Authenticator-Code ODER ein Backup-Code — beide gehen an dieselbe
    // Route (/api/account/login/2fa → /v1/auth/2fa/verify akzeptiert auch Backup-Codes).
    const value = useBackup ? backupCode.trim() : code.join("");
    if (useBackup ? value.length < 6 : value.length < 6) {
      setError(
        useBackup
          ? "Bitte gib einen gültigen Backup-Code ein."
          : "Bitte gib den 6-stelligen Code ein.",
      );
      return;
    }
    setLoading(true);
    try {
      const res = await send("/api/account/login/2fa", {
        challengeToken,
        code: value,
      });
      if (res && res.credentialLeak) {
        startLeakRecovery(res);
      } else if (res && res.correct) {
        await setOffline(false); // Anmeldung beendet den Offlinemodus.
        notifySessionChanged(); // Store/Wunschliste des Vorgängers verwerfen (owned-Flags!).
        notify("Angemeldet", "Willkommen zurück!", "success", 4000);
        navigate("/", { replace: true });
      } else {
        setError(
          typeof res?.data === "string"
            ? res.data
            : useBackup
              ? "Der Backup-Code ist falsch."
              : "Der 2FA-Code ist falsch.",
        );
        setCode(["", "", "", "", "", ""]);
        setBackupCode("");
        if (!useBackup) setTimeout(() => refs.current[0]?.focus(), 50);
      }
    } catch (err) {
      setError("Bestätigung fehlgeschlagen. Bitte versuch es erneut.");
    } finally {
      setLoading(false);
    }
  }

  /* --- Geleakte Zugangsdaten ---------------------------------------------------
     Der Server hat die Anmeldung angehalten: das Passwort steht in einem bekannten Datenleck.
     Ohne Authenticator-App wird ein Code per E-Mail geschickt; mit App zählt der Code, der eben
     im Login geprüft wurde. Danach neues Passwort, dann ist man drin. */
  function startLeakRecovery(res) {
    setLeak(res);
    setError("");
    setStep("leak");
    if (res.verification !== "totp") requestLeakCode(res.recoveryToken, false);
  }

  async function requestLeakCode(token, announce = true) {
    try {
      const res = await send(
        "/api/account/credential-alert/send-code",
        { recoveryToken: token || leak?.recoveryToken },
        true,
      );
      if (res?.status === 1) {
        if (announce)
          notify("Code verschickt", "Schau in dein Postfach.", "success", 4000);
      } else {
        setError(
          typeof res?.data === "string"
            ? res.data
            : "Der Code konnte nicht verschickt werden.",
        );
      }
    } catch {
      setError("Der Code konnte nicht verschickt werden.");
    }
  }

  async function submitLeakRecovery(e) {
    e.preventDefault();
    setError("");
    const needsCode = leak?.verification !== "totp";
    if (needsCode && leakCode.trim().length < 6) {
      setError("Bitte gib den 6-stelligen Code aus der E-Mail ein.");
      return;
    }
    if (
      newPassword.length < 8 ||
      !/[A-Za-z]/.test(newPassword) ||
      !/[0-9]/.test(newPassword)
    ) {
      setError(
        "Das neue Passwort braucht mindestens 8 Zeichen, einen Buchstaben und eine Ziffer.",
      );
      return;
    }
    setLoading(true);
    try {
      const res = await send("/api/account/credential-alert/resolve", {
        recoveryToken: leak.recoveryToken,
        code: leakCode.trim(),
        newPassword,
      });
      if (res && res.correct) {
        await setOffline(false);
        notifySessionChanged();
        notify(
          "Passwort geändert",
          "Alles erledigt. Du bist angemeldet.",
          "success",
          5000,
        );
        navigate("/", { replace: true });
      } else {
        setError(
          typeof res?.data === "string"
            ? res.data
            : "Das hat nicht geklappt. Prüfe Code und Passwort.",
        );
      }
    } catch {
      setError("Das hat nicht geklappt. Bitte versuch es erneut.");
    } finally {
      setLoading(false);
    }
  }

  if (step === "leak") {
    const needsCode = leak?.verification !== "totp";
    return (
      <AuthShell
        title="Dein Passwort ist nicht mehr sicher"
        lead={`Dieses Passwort taucht in einer Sammlung geleakter Zugangsdaten auf. Nicht bei uns, sondern bei einem anderen Anbieter. Bevor es weitergeht, brauchst du ein neues.`}
        footer={
          <>
            Was das bedeutet, steht in der{" "}
            <button
              type="button"
              className={authLinkCls}
              onClick={() =>
                openExternal(
                  "https://sketch-company.de/docs/sicherheit/geleakte-zugangsdaten",
                )
              }
            >
              Dokumentation
            </button>
            .
          </>
        }
      >
        <form onSubmit={submitLeakRecovery} className="flex flex-col gap-4">
          {needsCode ? (
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-text-secondary">
                Code aus der E-Mail an {leak?.email || "deine Adresse"}
              </span>
              <input
                className={error ? authErrorInputCls : authInputCls}
                value={leakCode}
                onChange={(e) =>
                  setLeakCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="6-stelliger Code"
                autoFocus
              />
              <button
                type="button"
                className={`${authLinkCls} self-start text-sm`}
                onClick={() => requestLeakCode(null, true)}
              >
                Code erneut senden
              </button>
            </label>
          ) : (
            <p className="m-0 text-sm text-text-muted">
              Deine Authenticator-App hast du gerade schon bestätigt. Es fehlt
              nur noch das neue Passwort.
            </p>
          )}

          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-text-secondary">Neues Passwort</span>
            <input
              className={error ? authErrorInputCls : authInputCls}
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="Mindestens 8 Zeichen, ein Buchstabe, eine Ziffer"
              autoFocus={!needsCode}
            />
          </label>

          {error && <p className="m-0 text-sm text-error">{error}</p>}

          <button className="cta cta-primary" disabled={loading}>
            {loading ? "Wird gespeichert…" : "Passwort ändern und anmelden"}
          </button>
        </form>
      </AuthShell>
    );
  }

  if (step === "totp") {
    return (
      <AuthShell
        title="Zwei-Faktor-Authentifizierung"
        lead={
          useBackup
            ? "Gib einen deiner Backup-Codes ein."
            : "Gib den 6-stelligen Code aus deiner Authenticator-App ein."
        }
        footer={
          <button
            type="button"
            className={`cursor-pointer ${authLinkCls}`}
            onClick={() => {
              setStep("creds");
              setError("");
              setCode(["", "", "", "", "", ""]);
              setBackupCode("");
              setUseBackup(false);
            }}
          >
            Zurück zur Anmeldung
          </button>
        }
      >
        <form className="flex flex-col gap-4" onSubmit={submitTotp}>
          {useBackup ? (
            <input
              className={error ? authErrorInputCls : authInputCls}
              placeholder="Backup-Code"
              value={backupCode}
              onChange={(e) => setBackupCode(e.target.value)}
              autoComplete="one-time-code"
              autoFocus
            />
          ) : (
            <CodeInputs code={code} refs={refs} setDigit={setDigit} />
          )}
          {error && (
            <div className="text-sm text-error" role="alert">
              {error}
            </div>
          )}
          <button
            type="submit"
            className="cta cta-primary w-full"
            disabled={loading}
          >
            {loading ? "Prüfen…" : "Bestätigen"}
          </button>
          <button
            type="button"
            className={`cursor-pointer text-sm ${authLinkCls}`}
            onClick={() => {
              setUseBackup((v) => !v);
              setError("");
              setCode(["", "", "", "", "", ""]);
              setBackupCode("");
            }}
          >
            {useBackup
              ? "Stattdessen Authenticator-Code verwenden"
              : "Mit Backup-Code anmelden"}
          </button>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      wide
      title="Anmelden"
      footer={
        <>
          Noch keinen Account?{" "}
          <Link to="/signup" replace className={authLinkCls}>
            Jetzt registrieren
          </Link>
        </>
      }
    >
      {/* Zweispaltig: normaler Login links, andere Methoden rechts — getrennt durch eine Linie.
			    Der Lead steht in der linken Spalte, damit die Spalten (und der Trennstrich) direkt
			    unter der Überschrift beginnen. */}
      <div className="mt-4 flex flex-col gap-6 md:flex-row md:gap-8">
        <form className="flex flex-1 flex-col gap-4" onSubmit={submitCreds}>
          <p className="text-sm text-text-secondary">
            Melde dich mit deinem Sketch Company Account an.
          </p>
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-text-secondary">
              Benutzername / E-Mail
            </span>
            <input
              className={error ? authErrorInputCls : authInputCls}
              placeholder="Benutzername oder E-Mail"
              value={userOrEmail}
              onChange={(e) => setUserOrEmail(e.target.value)}
              autoComplete="username"
              spellCheck={false}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-text-secondary">
              Passwort
            </span>
            <div className="relative">
              <input
                className={error ? authErrorInputCls : authInputCls}
                type={showPw ? "text" : "password"}
                placeholder="Passwort"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? "Passwort verbergen" : "Passwort anzeigen"}
                className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 cursor-pointer place-items-center rounded text-text-muted hover:text-text-primary focus-visible:outline-2 focus-visible:outline-neon-green"
              >
                <i
                  className={`bi ${showPw ? "bi-eye-slash" : "bi-eye"}`}
                  aria-hidden="true"
                />
              </button>
            </div>
            {error && (
              <span className="mt-1.5 block text-sm text-error" role="alert">
                {error}
              </span>
            )}
          </label>
          <button
            type="submit"
            className="cta cta-primary w-full"
            disabled={loading}
          >
            {loading ? "Anmelden…" : "Anmelden"}
          </button>
        </form>

        {/* Trennlinie: vertikal auf md+, horizontal auf mobil. */}
        <div
          className="h-px w-full bg-border md:h-auto md:w-px md:self-stretch"
          aria-hidden="true"
        />

        {/* Andere Anmeldemethoden rechts: OAuth vertikal zentriert, Offline-Block unten. */}
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex flex-1 flex-col justify-start gap-3">
            <span className="text-sm font-bold text-text-secondary">
              Oder anmelden mit
            </span>
            <OAuthButtons />
          </div>
          <div>
            <div className="mb-3 h-px w-full bg-border" aria-hidden="true" />
            <button
              type="button"
              className="cta cta-secondary w-full"
              onClick={playOffline}
            >
              <i className="bi bi-wifi-off" aria-hidden="true" /> Offline
              spielen
            </button>
            <p className="mt-1.5 text-center text-xs text-text-muted">
              Ohne Konto &amp; Internet — nur installierte Spiele.
            </p>
          </div>
        </div>
      </div>
    </AuthShell>
  );
}
