const {
  app,
  BrowserWindow,
  autoUpdater,
  Tray,
  Menu,
  nativeImage,
} = require("electron");
const config = require("./launcherConfig");
const func = require("./functions");
const path = require("path");

// Steam-artiger Hintergrundbetrieb: der Launcher wird beim Schließen NICHT beendet, sondern ins
// Tray versteckt (Prozess + Express-Server + Playtime-Tracking laufen weiter — Grundlage für spätere
// Features wie Overlay/Freunde/Hintergrund-Downloads). Echtes Beenden nur über Tray → „Beenden".
let tray = null;
app.isQuitting = false;

require("source-map-support").install();
const log = require("electron-log");
log.transports.file.level = "debug";
log.transports.file.resolvePathFn = (variables) => {
  return config.logFile;
};
Object.assign(console, log.functions);
process.on("uncaughtException", (error) => {
  console.error("Unhandled Exception:", error);
});

function checkIfLauncherIsAlreadyOpen() {
  return new Promise(async (cb) => {
    try {
      // Harte Zeitgrenze: ein hängender Port-Inhaber darf den Start nicht blockieren.
      // Der Normalfall (nichts lauscht auf 1520) schlägt ohnehin in ~1 ms fehl.
      const response = await fetch(
        "http://localhost:" + config.PORT + "/api/close-for-update",
        {
          headers: { "User-Agent": config.requestToken },
          signal: AbortSignal.timeout(700),
        },
      );
      config.PORT = 1521;
      console.log("checkIfLauncherIsAlreadyOpen:", response);
      cb(response);
    } catch (err) {
      console.log(
        "checkIfLauncherIsAlreadyOpen: could not request so launcher is already closed",
      );
      config.PORT = 1520;
      cb(err);
    }
  });
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require("electron-squirrel-startup")) {
  app.quit();
}

// Einmalige Backend-Initialisierung PRO PROZESS: lokaler Express-Server + Update-Check.
// Läuft beim ersten Start und bei einem echten Neustart (Auto-Update relaunched den Prozess),
// aber NICHT beim erneuten Aktivieren über das Dock — sonst würde sich der Launcher über
// /close-for-update selbst schließen (siehe spawnWindow/activate unten).
const bootBackend = async () => {
  // check if launcher is already open before initializing the backend server for the launcher
  await checkIfLauncherIsAlreadyOpen();
  require("./launcher");

  // Auto-Update NUR auf Windows: update-electron-app/Squirrel.Mac braucht auf macOS eine
  // signierte App (fehlt derzeit), Linux wird gar nicht unterstützt — ein unbedingter Aufruf
  // würde dort werfen. Auf anderen Plattformen still überspringen (Update dann manuell/Store).
  if (process.platform === "win32") {
    const notificationStore = require("./notificationStore");
    // Alten (evtl. hängenden) Launcher-Update-Pin beim Start entfernen — ein noch offenes
    // Update meldet sich gleich wieder über update-available.
    notificationStore
      .removeByKey("launcher-update", { force: true })
      .catch(() => {});
    autoUpdater.on("update-available", async function () {
      // Erst als Toast (Renderer-Auto-Toast beim nächsten Poll), dann als ANGEPINNTE, nicht
      // löschbare Nachricht in der Glocke — verschwindet erst, wenn das Update geladen ist.
      try {
        await notificationStore.add(
          {
            key: "launcher-update",
            pinned: true,
            type: "note",
            title: "Launcher-Update",
            message:
              "Ein Update für den Launcher wird geladen … bitte den Launcher nicht schließen.",
          },
          { os: true },
        );
      } catch (err) {
        console.error("update-available notification:", err);
      }
    });
    autoUpdater.on("update-downloaded", function () {
      notificationStore
        .removeByKey("launcher-update", { force: true })
        .catch(() => {});
    });
    require("update-electron-app").updateElectronApp({
      updateInterval: "5 minutes",
    });
  } else {
    console.log(
      "bootBackend: auto-update skipped on",
      process.platform,
      "(Windows-only for now)",
    );
  }
};

// Erzeugt das Fenster und lädt die Zielseite. Nutzt den bereits laufenden Server (config.PORT).
// Wird beim Start UND beim Dock-Reaktivieren aufgerufen — Letzteres pingt bewusst NICHT erneut
// /close-for-update an, damit der Launcher wieder aufgeht statt sich zu schließen.
/**
 * Einstellungen entschlüsselt lesen; bei unlesbarer/beschädigter Datei die Vorgaben. Wirft nie —
 * der Start darf daran nicht scheitern.
 */
async function readSettings() {
  try {
    return JSON.parse(func.decrypt(await func.read(config.settingsFile)));
  } catch (err) {
    console.error(
      "readSettings: failed to read/decrypt/parse settings, using settingsIntegrity:",
      err,
    );
    return config.settingsIntegrity;
  }
}

let started = false;
const spawnWindow = async () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 810,
    minHeight: 720,
    minWidth: 1280,
    maxWidth: 1920,
    autoHideMenuBar: true,
    icon: config.resources + "img/app.png",
    title: "Sketchy Games Launcher",
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#0d0f16",
      symbolColor: "#1cf58a",
      height: 25,
    },
    // The renderer is a plain web SPA that talks to the local Express server
    // over HTTP only — it needs no Node access. These are Electron's secure
    // defaults; set explicitly to document and guarantee the hardening.
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // set cookie and make sure only electron can access the express app
  mainWindow.webContents.setUserAgent(
    mainWindow.webContents.getUserAgent() + config.requestToken,
  );

  // Schließen (X) beendet den Launcher NICHT, sondern versteckt ihn ins Tray (Hintergrundbetrieb).
  // Echtes Beenden nur über das Tray-Menü (setzt app.isQuitting) oder Auto-Update-Übernahme.
  mainWindow.on("close", (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
      notifyBackgroundOnce();
    }
  });
  setupTray();

  // Schneller, rein lokaler Setup-Teil (Verzeichnisse/Dateien/Einstellungen) — einstellige ms.
  await config.setupPaths();

  // Ziel-Seite SOFORT laden (keine /loading-Zwischenseite, kein Netzwerk vor dem ersten Paint).
  const settings = await readSettings();
  // Login gate. Set SGL_SKIP_LOGIN=1 in the environment for local testing only —
  // never enabled by default in a build. Sitzung kommt aus session.dat (Token) —
  // der frühere userFile-Passwort-Check ist seit der v1-Migration immer leer.
  // „Bei Start anmelden" darf den Login nur dann überspringen, wenn die Session WIRKLICH gültig
  // ist (lokale JWT-exp-Prüfung). Bei abgelaufener/fehlender Session wird trotz deaktivierter
  // Option zur Anmeldung gezwungen. Widerrufene Tokens fängt zusätzlich der Renderer-Guard ab.
  // Offlinemodus überspringt den Login komplett (auch ohne gültige Sitzung) — der Nutzer will
  // bewusst ohne Anmeldung nur installierte Spiele spielen.
  const skipLogin = process.env.SGL_SKIP_LOGIN === "1";
  const hasSession = require("./session").isSessionValid();
  if (
    skipLogin ||
    settings.offlineMode ||
    (!settings.loginOnStartup && hasSession)
  ) {
    mainWindow.loadURL("http://localhost:" + config.PORT);
  } else mainWindow.loadURL("http://localhost:" + config.PORT + "/login");

  // Netzwerk-/Wartungsarbeiten (Verbindungscheck, Update-Check, Cover, Download-Resume)
  // NACH dem Fensteraufbau im Hintergrund — der Start wartet nie auf das Netz. Nur einmal
  // pro Prozess, damit ein Reaktivieren nicht z. B. Downloads doppelt wieder einreiht.
  if (!started) {
    started = true;
    setImmediate(() => config.setupBackground());
  }
  // Erst NACH dem ersten Bild: fragen, ob die Sitzung serverseitig überhaupt noch lebt.
  setImmediate(() => enforceRemoteSession());

  // Open the DevTools.
  !app.isPackaged || settings.console
    ? mainWindow.webContents.openDevTools()
    : console.log("spawnWindow: blocked dev tools from opening");
};

// Tray-Symbol (einmalig): LINKS-Klick öffnet/zeigt das Fenster; die Optionen (Öffnen/Beenden)
// erscheinen NUR per RECHTSKLICK. Deshalb kein setContextMenu (das würde auf macOS auch den
// Links-Klick auf das Menü legen) — das Menü wird bei "right-click" manuell aufgeklappt.
function setupTray() {
  if (tray) return;
  try {
    let img = nativeImage.createFromPath(config.resources + "img/app.png");
    if (!img.isEmpty()) img = img.resize({ width: 18, height: 18 });
    tray = new Tray(img.isEmpty() ? nativeImage.createEmpty() : img);
    tray.setToolTip("Sketchy Games Launcher");
    const menu = Menu.buildFromTemplate([
      { label: "Öffnen", click: () => showWindow() },
      { type: "separator" },
      {
        label: "Beenden",
        click: () => {
          app.isQuitting = true;
          app.quit();
        },
      },
    ]);
    tray.on("click", () => showWindow());
    tray.on("right-click", () => tray.popUpContextMenu(menu));
  } catch (err) {
    console.error("setupTray failed:", err);
  }
}
// Verstecktes Fenster wieder zeigen (oder ein neues erzeugen, falls keins existiert).
function showWindow() {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) {
    win.show();
    win.focus();
    // Der Launcher liegt Steam-artig tagelang im Tray: eine zwischenzeitlich beendete Sitzung
    // fiele sonst nie auf. spawnWindow() prüft selbst, deshalb nur im show()-Zweig.
    setImmediate(() => enforceRemoteSession());
  } else spawnWindow();
}

/**
 * Wirft raus, wenn der Server die Sitzung nicht mehr kennt (auf der Website abgemeldet,
 * Passwortwechsel). Ohne Verbindung oder bei Serverfehlern passiert NICHTS — `verifyRemote()`
 * antwortet dann mit null, und niemand soll wegen eines Ausfalls ausgesperrt werden.
 * Im Offlinemodus wird gar nicht erst gefragt: dort ist Nichtanmeldung gewollt.
 */
let lastOwnershipSync = 0;
async function enforceRemoteSession() {
  try {
    const settings = await readSettings();
    if (settings.offlineMode) return;
    const session = require("./session");
    const verdict = await session.verifyRemote();
    if (verdict !== false) {
      // Sitzung lebt (oder war nicht prüfbar): Gelegenheit für einen frischen Besitz-Spiegel —
      // eine Lizenz kann seit dem Start dazugekommen sein (Kauf auf der Website). Höchstens alle
      // 5 Minuten, damit das Zurückholen aus dem Tray keine Aufruf-Salve auslöst.
      if (verdict === true && Date.now() - lastOwnershipSync > 5 * 60 * 1000) {
        lastOwnershipSync = Date.now();
        const token = session.getToken();
        if (token)
          require("./ownership")
            .sync(token, session.getUserId())
            .catch(() => {});
      }
      return;
    }
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) return;
    // Steht die Anmeldung schon auf dem Schirm (Login-Gate hat bereits dorthin geladen), nicht
    // erneut navigieren — das würde die Seite mitten in der Eingabe zurücksetzen.
    const current = win.webContents.getURL() || "";
    if (/\/(login|signup|verify)(\?|#|$)/.test(current)) return;
    console.log(
      "enforceRemoteSession: Sitzung ungültig — zurück zur Anmeldung",
    );
    // Sonst steht der Nutzer ohne Erklärung auf der Login-Seite. Der Store liefert Glocke und
    // (falls erlaubt) eine OS-Meldung — letztere erreicht ihn auch beim Öffnen aus dem Tray.
    // Kein `key`: gegen Doppelmeldungen schützt schon die URL-Prüfung oben, und ein
    // liegengebliebener Eintrag würde eine spätere echte Abmeldung stumm schalten.
    await require("./notificationStore")
      .add(
        {
          type: "warning",
          title: "Sitzung beendet",
          message: "Deine Anmeldung wurde beendet. Bitte melde dich erneut an.",
        },
        { os: true },
      )
      .catch(() => {});
    await win.loadURL("http://localhost:" + config.PORT + "/login");
  } catch (err) {
    console.error("enforceRemoteSession failed:", err);
  }
}
// Einmalige Info, dass der Launcher im Hintergrund weiterläuft.
let backgroundNoticeShown = false;
function notifyBackgroundOnce() {
  if (backgroundNoticeShown) return;
  backgroundNoticeShown = true;
  try {
    func.sendNotification(
      "Sketchy Games Launcher läuft weiter",
      "Der Launcher läuft im Hintergrund weiter. Beende ihn über das Tray-Symbol.",
    );
  } catch (err) {
    console.error("notifyBackgroundOnce failed:", err);
  }
}
// Für andere Module (api.js: „Schließen"/Hintergrund-Option nach Spielstart) erreichbar machen.
global.sketchyShowWindow = showWindow;
global.sketchyBackgroundNotice = notifyBackgroundOnce;

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", async () => {
  await bootBackend();
  await spawnWindow();
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open. Der Server läuft noch —
  // deshalb NUR ein neues Fenster (spawnWindow), KEIN bootBackend (kein Selbst-Ping auf
  // /close-for-update, der den Launcher sonst gleich wieder schließen würde).
  if (BrowserWindow.getAllWindows().length === 0) {
    spawnWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
