import { Routes, Route } from "react-router-dom"
import AppShell from "./components/shell/AppShell.jsx"
import SessionGuard from "./lib/session.jsx"
import Home from "./pages/Home.jsx"
import Library from "./pages/Library.jsx"
import Store from "./pages/Store.jsx"
import Search from "./pages/Search.jsx"
import Product from "./pages/Product.jsx"
import Studio from "./pages/Studio.jsx"
import Reviews from "./pages/Reviews.jsx"
import Account from "./pages/Account.jsx"
import Downloads from "./pages/Downloads.jsx"
import News, { ReleaseNotes } from "./pages/News.jsx"
import Settings from "./pages/Settings.jsx"
import ErrorPage from "./pages/ErrorPage.jsx"
import Login from "./pages/Login.jsx"
import Signup from "./pages/Signup.jsx"
import Verify from "./pages/Verify.jsx"
import Loading from "./pages/Loading.jsx"
import OnlineOnly from "./components/OnlineOnly.jsx"

export default function App() {
    return (
        <Routes>
            {/* Blocked pages: no shared chrome */}
            <Route path="/loading" element={<Loading />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/verify" element={<Verify />} />

            {/* Pages with shared chrome — hinter dem Session-Guard (Login-Pflicht) */}
            <Route element={<SessionGuard />}>
              <Route element={<AppShell />}>
                <Route path="/" element={<Home />} />
                <Route path="/library" element={<Library />} />
                {/* Online-Routen: im Offlinemodus zeigt OnlineOnly „Nur online verfügbar". */}
                <Route path="/store" element={<OnlineOnly><Store /></OnlineOnly>} />
                <Route path="/store/:product" element={<OnlineOnly><Product /></OnlineOnly>} />
                <Route path="/store/:id/reviews" element={<OnlineOnly><Reviews /></OnlineOnly>} />
                <Route path="/studio/:slug" element={<OnlineOnly><Studio /></OnlineOnly>} />
                <Route path="/search" element={<OnlineOnly><Search /></OnlineOnly>} />
                <Route path="/account" element={<OnlineOnly><Account /></OnlineOnly>} />
                <Route path="/downloads" element={<OnlineOnly><Downloads /></OnlineOnly>} />
                <Route path="/news" element={<OnlineOnly><News /></OnlineOnly>} />
                <Route path="/news/launcher/:version" element={<OnlineOnly><ReleaseNotes /></OnlineOnly>} />
                <Route path="/news/game/:gameId/:version" element={<OnlineOnly><ReleaseNotes /></OnlineOnly>} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/error" element={<ErrorPage />} />
                <Route path="*" element={<ErrorPage />} />
              </Route>
            </Route>
        </Routes>
    )
}
