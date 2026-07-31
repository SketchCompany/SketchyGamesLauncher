import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useNotify } from "../lib/notifications.jsx";
import { useOffline } from "../lib/offline.jsx";
import AuthShell, {
  authInputCls,
  authErrorInputCls,
  authLinkCls,
} from "../components/AuthShell.jsx";
import OAuthButtons from "../components/OAuthButtons.jsx";
import { passwordProblem } from "../lib/utils.js";

function validate({ user, email, password, confirm }) {
  const e = {};
  if (user.length < 3) e.user = "Mindestens 3 Zeichen.";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) e.email = "Ungültige E-Mail.";
  const pwProblem = passwordProblem(password);
  if (pwProblem) e.password = pwProblem;
  if (confirm !== password) e.confirm = "Passwörter stimmen nicht überein.";
  return e;
}

function Field({ label, error, type = "text", autoComplete, ...props }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-bold text-text-secondary">
        {label}
      </span>
      <input
        className={error ? authErrorInputCls : authInputCls}
        type={type}
        autoComplete={autoComplete}
        {...props}
      />
      {error && (
        <span className="mt-1.5 block text-sm text-error" role="alert">
          {error}
        </span>
      )}
    </label>
  );
}

/** Wie Field, aber mit Auge-Umschalter zum Anzeigen/Verbergen des Passworts. */
function PasswordField({ label, error, autoComplete, ...props }) {
  const [show, setShow] = useState(false);
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-bold text-text-secondary">
        {label}
      </span>
      <div className="relative">
        <input
          className={(error ? authErrorInputCls : authInputCls) + " pr-10"}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? "Passwort verbergen" : "Passwort anzeigen"}
          className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 cursor-pointer place-items-center rounded text-text-muted hover:text-text-primary focus-visible:outline-2 focus-visible:outline-neon-green"
        >
          <i
            className={`bi ${show ? "bi-eye-slash" : "bi-eye"}`}
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
  );
}

export default function Signup() {
  const [form, setForm] = useState({
    user: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [errors, setErrors] = useState({});
  const navigate = useNavigate();
  const notify = useNotify();
  const { setOffline } = useOffline();
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // „Offline spielen": Offlinemodus aktivieren und ohne Anmeldung in die Bibliothek.
  async function playOffline() {
    await setOffline(true);
    navigate("/library", { replace: true });
  }

  function submit(e) {
    e.preventDefault();
    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    // Email verification step handles the actual account creation.
    notify(
      "Bestätigung",
      "Wir senden dir einen Code zur Verifizierung.",
      "note",
      5000,
    );
    navigate("/verify", {
      state: { user: form.user, email: form.email, password: form.password },
      replace: true,
    });
  }

  return (
    <AuthShell
      wide
      title="Registrieren"
      footer={
        <>
          Bereits registriert?{" "}
          <Link to="/login" replace className={authLinkCls}>
            Anmelden
          </Link>
        </>
      }
    >
      {/* Zweispaltig: Registrierung links, andere Methoden rechts — getrennt durch eine Linie.
			    Der Lead steht in der linken Spalte, damit die Spalten (und der Trennstrich) direkt
			    unter der Überschrift beginnen. */}
      <div className="mt-4 flex flex-col gap-6 md:flex-row md:gap-8">
        <form className="flex flex-1 flex-col gap-4" onSubmit={submit}>
          <p className="text-sm text-text-secondary">
            Erstelle deinen kostenlosen Sketch Company Account.
          </p>
          <Field
            label="Benutzername"
            placeholder="Benutzername"
            value={form.user}
            onChange={set("user")}
            error={errors.user}
            autoComplete="username"
            spellCheck={false}
          />
          <Field
            label="E-Mail"
            placeholder="name@beispiel.de"
            type="email"
            value={form.email}
            onChange={set("email")}
            error={errors.email}
            autoComplete="email"
            spellCheck={false}
          />
          <PasswordField
            label="Passwort"
            placeholder="8–72 Zeichen, mind. 1 Buchstabe & 1 Ziffer"
            value={form.password}
            onChange={set("password")}
            error={errors.password}
            autoComplete="new-password"
          />
          <PasswordField
            label="Passwort bestätigen"
            placeholder="Passwort wiederholen"
            value={form.confirm}
            onChange={set("confirm")}
            error={errors.confirm}
            autoComplete="new-password"
          />
          <button type="submit" className="cta cta-primary w-full">
            Weiter
          </button>
        </form>

        {/* Trennlinie: vertikal auf md+, horizontal auf mobil. */}
        <div
          className="h-px w-full bg-border md:h-auto md:w-px md:self-stretch"
          aria-hidden="true"
        />

        {/* Andere Methoden rechts: OAuth vertikal zentriert, Offline-Block unten.
			    Social-Login legt bei Bedarf automatisch ein Konto an (match-or-create). */}
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex flex-1 flex-col justify-start gap-3">
            <span className="text-sm font-bold text-text-secondary">
              Oder registrieren mit
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
