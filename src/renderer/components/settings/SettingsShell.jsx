import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { get, send } from "../../lib/api.js";
import { useNotify } from "../../lib/notifications.jsx";
import { useOffline } from "../../lib/offline.jsx";
import { Switch } from "@/components/ui/shadcn/switch";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/shadcn/select";
import { cn } from "@/lib/utils";
import KontoSection from "./KontoSection.jsx";
import SicherheitSection from "./SicherheitSection.jsx";
import ForeignInstalls from "./ForeignInstalls.jsx";
import { PanelSkeleton } from "../Skeletons.jsx";
import { minSettle } from "../../lib/minDelay.js";
import ErrorState from "../ErrorState.jsx";

const SECTIONS = [
  { id: "konto", label: "Konto", icon: "bi-person-circle" },
  { id: "sicherheit", label: "Sicherheit", icon: "bi-shield-lock" },
  { id: "benachrichtigungen", label: "Benachrichtigungen", icon: "bi-bell" },
  { id: "downloads", label: "Downloads & Installation", icon: "bi-download" },
  { id: "spielstart", label: "Funktionen", icon: "bi-sliders" },
  { id: "entwickler", label: "Entwickler", icon: "bi-braces" },
  { id: "ueber", label: "Über", icon: "bi-info-circle" },
];

/** Einstellungszeile: Label + Beschreibung links, Schalter rechts. */
function SettingRow({ label, hint, checked, onChange }) {
  return (
    <div className="hud-frame flex items-center justify-between gap-4 p-4">
      <div>
        <p className="m-0 font-bold text-text-primary">{label}</p>
        <p className="m-0 mt-0.5 text-sm text-text-muted">{hint}</p>
      </div>
      <Switch
        checked={!!checked}
        onCheckedChange={onChange}
        aria-label={label}
      />
    </div>
  );
}

function SectionHead({ title, sub }) {
  return (
    <header className="settings-section__head">
      <h3 className="settings-section__title">{title}</h3>
      {sub && <p className="settings-section__sub">{sub}</p>}
    </header>
  );
}

/** Zwischen-Überschrift + kleiner Untertitel, um zusammengehörige Einstellungen zu bündeln. */
export function SettingGroup({ title, sub, children }) {
  return (
    <div className="settings-group">
      <div className="settings-group__head">
        <h4 className="settings-group__title">{title}</h4>
        {sub && <p className="settings-group__sub">{sub}</p>}
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

/**
 * Discord-artige Einstellungen: links eine Kategorie-Leiste, rechts der Inhalt der gewählten
 * Kategorie. Vereint Einstellungen + Konto in einer Oberfläche (Account-Route öffnet „Konto").
 */
export default function SettingsShell({
  defaultSection = "benachrichtigungen",
}) {
  // Aktiver Tab liegt in der URL (?tab=…), damit ein Neuladen die Kategorie behält
  // statt auf die Standard-Kategorie zurückzuspringen. Unbekannte Werte → Standard.
  const [searchParams, setSearchParams] = useSearchParams();
  const { offline, setOffline } = useOffline();
  // Im Offlinemodus die netzabhängigen Abschnitte (Konto, Sicherheit) ausblenden.
  const sections = offline
    ? SECTIONS.filter((s) => s.id !== "konto" && s.id !== "sicherheit")
    : SECTIONS;
  const requested = searchParams.get("tab");
  const active = sections.some((s) => s.id === requested)
    ? requested
    : sections.some((s) => s.id === defaultSection)
      ? defaultSection
      : sections[0].id;
  const setActive = (id) => setSearchParams({ tab: id }, { replace: true });
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState(null);
  const notify = useNotify();

  // Bei Retry bleibt das Skeleton mind. 1s sichtbar (minSettle), damit es nicht aufblitzt.
  const loadSettings = useCallback((retry = false) => {
    setError(null);
    setSettings(null);
    const settle = minSettle(retry);
    get("/api/settings")
      .then((d) => settle(() => setSettings(d)))
      .catch((e) => settle(() => setError(e)));
  }, []);

  useEffect(() => loadSettings(false), [loadSettings]);

  const update = (patch) => setSettings((s) => ({ ...s, ...patch }));

  async function persist(next) {
    const merged = { ...settings, ...next };
    setSettings(merged);
    try {
      await send("/api/settings", merged);
    } catch (err) {
      notify(
        "Fehler",
        "Einstellung konnte nicht gespeichert werden: " + err,
        "error",
      );
    }
  }

  async function pickPath() {
    try {
      const res = await get("/api/settings/open");
      const newPath = res?.path || res;
      if (
        newPath &&
        typeof newPath === "string" &&
        settings.installationPath &&
        newPath !== settings.installationPath
      ) {
        await send("/api/settings/move", {
          oldInstallationPath: settings.installationPath,
          newInstallationPath: newPath,
        });
        update({ installationPath: newPath });
        notify("Verschoben", "Installationsordner wurde geändert.", "success");
      }
    } catch (err) {
      notify("Fehler", String(err), "error");
    }
  }

  function renderSection() {
    if (active === "konto") return <KontoSection />;
    if (active === "sicherheit") return <SicherheitSection />;

    if (error) {
      return <ErrorState error={error} onRetry={() => loadSettings(true)} />;
    }
    if (!settings)
      return (
        <div className="settings-section">
          <PanelSkeleton rows={4} />
        </div>
      );

    switch (active) {
      case "benachrichtigungen":
        return (
          <section className="settings-section">
            <SectionHead
              title="Benachrichtigungen"
              sub="Steuere In-App- und System-Hinweise."
            />
            <div className="flex flex-col gap-3">
              <SettingRow
                label="Benachrichtigungen"
                hint="In-App-Benachrichtigungen anzeigen."
                checked={settings.notifications}
                onChange={(v) => persist({ notifications: v })}
              />
              <SettingRow
                label="Desktop-Benachrichtigungen"
                hint="Systembenachrichtigungen erlauben."
                checked={settings.desktopNotifications}
                onChange={(v) => persist({ desktopNotifications: v })}
              />
            </div>
          </section>
        );
      case "downloads":
        return (
          <section className="settings-section">
            <SectionHead
              title="Downloads & Installation"
              sub="Wohin deine Spiele installiert werden."
            />
            <div className="hud-frame p-4">
              <label className="mb-1.5 block font-bold text-text-primary">
                Installationsordner
              </label>
              <div className="flex gap-2.5">
                <input
                  readOnly
                  value={settings.installationPath || ""}
                  aria-label="Installationsordner"
                  className="w-full rounded border border-border-strong bg-bg-2 px-3 py-2.5 text-sm text-text-secondary focus:outline-none"
                />
                <button
                  className="cta cta-secondary !px-4 !py-2 whitespace-nowrap text-sm"
                  onClick={pickPath}
                >
                  <i className="bi bi-folder2-open" aria-hidden="true" /> Ändern
                </button>
              </div>
              <p className="m-0 mt-1.5 text-sm text-text-muted">
                Hier werden deine Spiele installiert.
              </p>
            </div>
            {/* Installationen ohne Lizenz des angemeldeten Kontos — nur sichtbar, wenn es welche gibt. */}
            <ForeignInstalls />
          </section>
        );
      case "spielstart":
        return (
          <section className="settings-section">
            <SectionHead
              title="Funktionen"
              sub="Ändere das Verhalten des Launchers und passe ihn nach deinen Wünschen an."
            />
            <SettingGroup
              title="Spielstart"
              sub="Was mit dem Launcher passiert, wenn du ein Spiel startest."
            >
              <div className="hud-frame flex flex-col gap-2 p-4">
                <label className="font-bold text-text-primary">
                  Nach dem Spielstart
                </label>
                <Select
                  value={String(settings.actionAfterGameStarted ?? 1)}
                  onValueChange={(v) =>
                    persist({ actionAfterGameStarted: Number(v) })
                  }
                >
                  <SelectTrigger className="max-w-sm">
                    <SelectValue placeholder="Aktion wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">
                      In den Hintergrund (läuft weiter)
                    </SelectItem>
                    <SelectItem value="1">Fenster minimieren</SelectItem>
                    <SelectItem value="2">Offen lassen</SelectItem>
                  </SelectContent>
                </Select>
                <p className="m-0 mt-1 text-sm text-text-muted">
                  „In den Hintergrund" versteckt den Launcher ins Tray und lässt
                  ihn weiterlaufen – so wird die Spielzeit erfasst und künftige
                  Funktionen (Overlay, Freunde, Hintergrund-Downloads) sind
                  möglich.
                </p>
              </div>
            </SettingGroup>
            <SettingGroup
              title="Anmeldung"
              sub="Verhalten beim Öffnen des Launchers."
            >
              <SettingRow
                label="Bei Start anmelden"
                hint="Der Launcher fragt bei jedem Öffnen nach deiner Anmeldung. Wenn deaktiviert, meldest du dich einmal an und bleibst angemeldet, bis die Sitzung abläuft oder du sie unter Sicherheit beendest."
                checked={settings.loginOnStartup}
                onChange={(v) => persist({ loginOnStartup: v })}
              />
              <SettingRow
                label="Offlinemodus"
                hint="Ohne Anmeldung nur installierte Spiele spielen. Online-Bereiche (Store, Suche, Konto) werden deaktiviert."
                checked={settings.offlineMode}
                onChange={(v) => {
                  setOffline(v);
                  setSettings((s) => ({ ...(s || {}), offlineMode: v }));
                }}
              />
            </SettingGroup>
          </section>
        );
      case "entwickler":
        return (
          <section className="settings-section">
            <SectionHead
              title="Entwickler"
              sub="Werkzeuge für Fehlersuche & Entwicklung."
            />
            <SettingRow
              label="Entwicklerkonsole"
              hint="DevTools beim Start öffnen."
              checked={settings.console}
              onChange={(v) => persist({ console: v })}
            />
          </section>
        );
      case "ueber":
        return (
          <section className="settings-section">
            <SectionHead title="Über" sub="Informationen zum Launcher." />
            <div className="hud-frame flex items-center gap-3 p-5">
              <img
                src="/img/app.png"
                width={44}
                height={44}
                alt=""
                className="rounded-lg"
              />
              <div>
                <p className="m-0 font-display text-lg font-bold text-text-primary">
                  Sketchy Games Launcher
                </p>
                <p className="m-0 text-sm text-text-muted">
                  {settings.version
                    ? `Version ${settings.version}`
                    : "Version unbekannt"}
                </p>
              </div>
            </div>
          </section>
        );
      default:
        return null;
    }
  }

  return (
    <div className="page">
      <div className="settings-shell">
        <aside
          className="settings-rail hud-frame"
          aria-label="Einstellungs-Kategorien"
        >
          <p className="settings-rail__title">
            <span className="bi bi-gear" aria-hidden="true" /> Einstellungen
          </p>
          <nav className="settings-rail__nav" role="tablist">
            {sections.map((s) => (
              <button
                key={s.id}
                role="tab"
                aria-selected={active === s.id}
                className={cn(
                  "settings-rail__item",
                  active === s.id && "is-active",
                )}
                onClick={() => setActive(s.id)}
              >
                <i className={`bi ${s.icon}`} aria-hidden="true" /> {s.label}
              </button>
            ))}
          </nav>
        </aside>
        <div className="settings-content" role="tabpanel">
          {renderSection()}
        </div>
      </div>
    </div>
  );
}
