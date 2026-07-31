import { useEffect, useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { get } from "../lib/api.js";
import { useStore } from "../lib/store.jsx";
import { useGameActions } from "../lib/gameActions.jsx";
import { useOffline } from "../lib/offline.jsx";
import { fadeUp } from "../lib/motion.js";
import GameRow from "../components/store/GameRow.jsx";
import NewsSection from "../components/news/NewsSection.jsx";
import ErrorState from "../components/ErrorState.jsx";
import { GameRowSkeleton, TileSkeleton, Skeleton } from "../components/Skeletons.jsx";

/**
 * Startseite. Der statische Hero rendert SOFORT (kein Netzwerk nötig); „Zuletzt gespielt“
 * kommt aus lokalen Daten (sehr schnell, Tile-Skeleton als Fallback) und die Store-Reihe
 * lädt im Hintergrund hinter einem Reihen-Skeleton. Kein Voll-Spinner mehr.
 */
export default function Home() {
  const [lastPlayed, setLastPlayed] = useState(undefined); // undefined = lädt, null = keins
  const [name, setName] = useState(undefined); // undefined = lädt, null = unbekannt/offline
  const navigate = useNavigate();
  const { play, launchingName } = useGameActions();
  const { offline } = useOffline();

  // Store-Reihe aus dem geteilten Cache: undefined = lädt (Skeleton), null = Fehler.
  const { data: storeData, error: storeError, refresh } = useStore();
  const store = storeData ? storeData : storeError ? null : undefined;

  useEffect(() => {
    let alive = true;
    get("/api/lastplayed")
      .then((d) => {
        if (alive) setLastPlayed(d && d.name ? d : null);
      })
      .catch(() => {
        if (alive) setLastPlayed(null);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Nutzername für die Begrüßung. Offline gibt es keine Profildaten (/api/account liefert dann
  // nur noch die id) — dann bleibt es beim neutralen „im Launcher".
  useEffect(() => {
    if (offline) {
      setName(null);
      return;
    }
    let alive = true;
    get("/api/account")
      .then((d) => {
        if (alive) setName((d && (d.username || d.user)) || null);
      })
      .catch(() => {
        if (alive) setName(null);
      });
    return () => {
      alive = false;
    };
  }, [offline]);

  // Geteilt mit Bibliothek, Produktseite und Kontextmenü (lib/gameActions.jsx) — inkl. Start-Overlay.
  function playLast(e) {
    if (!lastPlayed?.start) return;
    play(lastPlayed, e);
  }

  const showcase = store
    ? (
        (store.categories &&
          store.categories[0] &&
          store.categories[0].games) ||
        store.games ||
        []
      ).slice(0, 8)
    : [];

  // Im Offlinemodus rendert die Startseite Store-Inhalte, die es nicht gibt → direkt zur Bibliothek.
  if (offline) return <Navigate to="/library" replace />;

  return (
    <div className="page">
      <div className="grid grid-cols-[1.6fr_1fr] items-start gap-8 max-lg:grid-cols-1">
        <div className="flex flex-col justify-start gap-4">
          <span className="eyebrow">Willkommen zurück</span>
          <h1 className="gradient-text m-0 text-5xl font-bold max-md:text-4xl">
            {name === undefined ? (
              <Skeleton className="inline-block h-[1em] w-[7ch] align-middle rounded-lg" />
            ) : (
              name || "im Launcher"
            )}
          </h1>
          <p className="m-0 max-w-md text-text-secondary">
            Entdecke neue Spiele und starte sie direkt aus deiner Bibliothek.
          </p>
          <div className="flex gap-3">
            <button
              className="cta cta-primary"
              onClick={() => navigate("/store")}
            >
              <i className="bi bi-bag" aria-hidden="true" /> Zum Store
            </button>
            <button
              className="cta cta-secondary"
              onClick={() => navigate("/library")}
            >
              <i className="bi bi-controller" aria-hidden="true" /> Bibliothek
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-4">
          {lastPlayed === undefined ? (
            <TileSkeleton />
          ) : (
            <motion.div className="hud-frame p-5" variants={fadeUp} initial="initial" animate="animate">
              <span className="eyebrow">Zuletzt gespielt</span>
              {lastPlayed ? (
                <>
                  <h3 className="mb-3.5 mt-2.5 font-display text-lg font-bold">
                    {lastPlayed.title || lastPlayed.name}
                  </h3>
                  <button
                    className={`cta cta-primary${launchingName === lastPlayed.name ? " cta-launching" : ""}`}
                    onClick={playLast}
                  >
                    <i className="bi bi-play-fill" aria-hidden="true" />{" "}
                    Fortsetzen
                  </button>
                </>
              ) : (
                <p className="mb-0 mt-2.5 text-text-muted">
                  Noch kein Spiel gespielt. Stöber doch mal im Store.
                </p>
              )}
            </motion.div>
          )}
        </div>
      </div>

      <NewsSection />

      <div className="mt-12">
        {store === undefined ? (
          <GameRowSkeleton />
        ) : storeError && !storeData ? (
          <ErrorState variant="inline" error={storeError} onRetry={refresh} />
        ) : showcase.length > 0 ? (
          <GameRow
            title="Aus dem Store"
            icon="bi-bag"
            games={showcase}
            moreTo="/store"
          />
        ) : null}
      </div>
    </div>
  );
}
