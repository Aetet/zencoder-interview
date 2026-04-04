import { connectLogger, log } from "@reatom/core"
import { createRoot } from "react-dom/client"
import { App } from "./App"
import "./app.css"

// connectLogger() // disabled — freezes with 1000+ team atoms. Enable for debugging small datasets.
// @ts-expect-error
globalThis.LOG = log

createRoot(document.getElementById("root")!).render(<App />)
