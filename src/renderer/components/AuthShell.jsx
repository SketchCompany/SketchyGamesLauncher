import { motion } from "framer-motion";
import { fadeUp } from "../lib/motion.js";
import { cn } from "@/lib/utils";

/** Zentrierte Karte für die Auth-Screens (Login/Registrieren/Verifizieren).
 *  `wide` verbreitert die Karte (zweispaltiges Login: Formular links, Social-Login rechts). */
export default function AuthShell({ title, lead, children, footer, wide }) {
  return (
    <div className="grid min-h-dvh place-items-center p-6">
      <motion.div
        variants={fadeUp}
        initial="initial"
        animate="animate"
        className={cn("hud-frame w-full bg-bg-1/80 p-8 backdrop-blur", wide ? "max-w-3xl" : "max-w-md")}
      >
        <div className="mb-5 flex items-center gap-2.5">
          <img
            src="/img/app.png"
            width={40}
            height={40}
            alt="Sketchy Games Logo"
            className="rounded-lg"
          />
          <b className="font-display text-lg text-text-primary">
            Sketchy Games Launcher
          </b>
          {/* Launcher-Version oben rechts, auf Höhe des Namens. */}
          <span className="ml-auto font-display text-xs text-text-muted">
            v{__APP_VERSION__}
          </span>
        </div>
        <h1 className="m-0 font-display text-2xl font-bold text-text-primary">
          {title}
        </h1>
        {lead && (
          <p className="mb-5 mt-1.5 text-sm text-text-secondary">{lead}</p>
        )}
        {children}
        {footer && (
          <div className="mt-5 text-center text-sm text-text-muted">
            {footer}
          </div>
        )}
      </motion.div>
    </div>
  );
}

// Klar als Link erkennbar: halbfett + dauerhaft unterstrichen (nicht erst bei Hover).
// Farbe: abgeschwächtes Neon-Grün (Vollton beim Hover).
export const authLinkCls =
  "font-semibold text-neon-green/80 underline underline-offset-2 decoration-neon-green/40 transition-colors hover:text-neon-green hover:decoration-neon-green focus-visible:outline-2 focus-visible:outline-neon-green";

export const authInputCls =
  "w-full rounded border border-border-strong bg-bg-2 px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-neon-green focus:outline-none";
export const authErrorInputCls =
  "w-full rounded border border-error bg-bg-2 px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none";

/** 6-stellige Code-Eingabe (2FA / E-Mail-Verifizierung). */
export function CodeInputs({ code, refs, setDigit }) {
  return (
    <div className="flex justify-center gap-2">
      {code.map((d, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          value={d}
          inputMode="numeric"
          maxLength={1}
          aria-label={`Ziffer ${i + 1}`}
          onChange={(e) => setDigit(i, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !d && i > 0)
              refs.current[i - 1]?.focus();
          }}
          className="size-12 rounded border border-border-strong bg-bg-2 text-center font-display text-xl text-text-primary focus:border-neon-green focus:outline-none"
        />
      ))}
    </div>
  );
}
