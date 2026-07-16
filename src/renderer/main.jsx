import "./styles/global.css"
import "bootstrap-icons/font/bootstrap-icons.css"
import React from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import App from "./App.jsx"
import { NotificationsProvider } from "./lib/notifications.jsx"
import { DialogProvider } from "./lib/dialog.jsx"

createRoot(document.getElementById("root")).render(
    <React.StrictMode>
        <BrowserRouter>
            <NotificationsProvider>
                <DialogProvider>
                    <App />
                </DialogProvider>
            </NotificationsProvider>
        </BrowserRouter>
    </React.StrictMode>
)
