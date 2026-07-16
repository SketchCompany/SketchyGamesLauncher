import { Routes, Route } from "react-router-dom"
import AppShell from "./components/shell/AppShell.jsx"
import Home from "./pages/Home.jsx"
import Library from "./pages/Library.jsx"
import Store from "./pages/Store.jsx"
import Product from "./pages/Product.jsx"
import Account from "./pages/Account.jsx"
import Downloads from "./pages/Downloads.jsx"
import Settings from "./pages/Settings.jsx"
import News from "./pages/News.jsx"
import Notes from "./pages/Notes.jsx"
import ErrorPage from "./pages/ErrorPage.jsx"
import Login from "./pages/Login.jsx"
import Signup from "./pages/Signup.jsx"
import Verify from "./pages/Verify.jsx"
import Loading from "./pages/Loading.jsx"

export default function App() {
    return (
        <Routes>
            {/* Blocked pages: no shared chrome */}
            <Route path="/loading" element={<Loading />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/verify" element={<Verify />} />

            {/* Pages with shared chrome */}
            <Route element={<AppShell />}>
                <Route path="/" element={<Home />} />
                <Route path="/library" element={<Library />} />
                <Route path="/store" element={<Store />} />
                <Route path="/store/:product" element={<Product />} />
                <Route path="/account" element={<Account />} />
                <Route path="/downloads" element={<Downloads />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/news" element={<News />} />
                <Route path="/notes" element={<Notes />} />
                <Route path="/error" element={<ErrorPage />} />
                <Route path="*" element={<ErrorPage />} />
            </Route>
        </Routes>
    )
}
