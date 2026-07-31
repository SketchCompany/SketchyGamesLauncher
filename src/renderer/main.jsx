import "./styles/app.css"
import "bootstrap-icons/font/bootstrap-icons.css"
import React from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import { MotionConfig } from "framer-motion"
import App from "./App.jsx"
import { NotificationsProvider } from "./lib/notifications.jsx"
import { DialogProvider } from "./lib/dialog.jsx"
import { WishlistProvider } from "./lib/wishlist.jsx"
import { StoreProvider } from "./lib/store.jsx"
import { OfflineProvider } from "./lib/offline.jsx"
import { LaunchOverlayProvider } from "./lib/launchOverlay.jsx"

createRoot(document.getElementById("root")).render(
    <React.StrictMode>
        <BrowserRouter>
            <MotionConfig reducedMotion="user">
                {/* Notifications außen: der Toast-Stapel (z-[1100]) muss über dem Start-Overlay
                    (z-[1050]) liegen, damit ein Fehler beim Spielstart lesbar bleibt. */}
                <NotificationsProvider>
                    <LaunchOverlayProvider>
                        <OfflineProvider>
                            <StoreProvider>
                                <WishlistProvider>
                                    <DialogProvider>
                                        <App />
                                    </DialogProvider>
                                </WishlistProvider>
                            </StoreProvider>
                        </OfflineProvider>
                    </LaunchOverlayProvider>
                </NotificationsProvider>
            </MotionConfig>
        </BrowserRouter>
    </React.StrictMode>
)
