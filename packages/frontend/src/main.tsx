import { log, connectLogger } from "@reatom/core"
import { createRoot } from "react-dom/client"
import { App } from "./App"
import "./app.css"

connectLogger() // Enable for debugging
globalThis.LOG = log

createRoot(document.getElementById("root")!).render(<App />)
