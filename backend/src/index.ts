import "./lib/env";
import path from "path";
import fs from "fs";
import express from "express";
import cors from "cors";
import { chatRouter } from "./routes/chat";
import { projectsRouter } from "./routes/projects";
import { projectChatRouter } from "./routes/projectChat";
import { documentsRouter } from "./routes/documents";
import { tabularRouter } from "./routes/tabular";
import { workflowsRouter } from "./routes/workflows";
import { userRouter } from "./routes/user";
import { downloadsRouter } from "./routes/downloads";

const app = express();
const PORT = Number(process.env.PORT ?? 3001);

// Inside the Android APK the same Express instance serves the compiled
// frontend and the API on 127.0.0.1, so local/cleartext origins are allowed.
const allowedOrigins = new Set(
    [
        process.env.FRONTEND_URL ?? "http://localhost:3000",
        "http://localhost",
        "http://127.0.0.1",
        "http://127.0.0.1:3001",
        "http://localhost:3001",
        "capacitor://localhost",
        "https://localhost",
    ].filter(Boolean) as string[],
);
app.use(
    cors({
        origin: (origin, cb) => {
            if (
                !origin ||
                allowedOrigins.has(origin) ||
                origin.startsWith("http://127.0.0.1") ||
                origin.startsWith("http://localhost")
            ) {
                return cb(null, true);
            }
            return cb(null, false);
        },
        credentials: true,
    }),
);

app.use(express.json({ limit: "50mb" }));

// Serve the statically exported frontend (Step 3 of the Android port) from
// this same process so the embedded APK WebView only needs one local server.
// Mounted before the API routers and limited to reserved UI paths plus
// existing asset files, so API routes like /workflows/:id still work.
// Node runs with cwd '/' inside the APK, so resolve the exported UI relative
// to this file (dist/index.js -> project root/public) with a cwd fallback for
// desktop dev.
const PUBLIC_DIR = fs.existsSync(path.resolve(__dirname, "..", "public"))
    ? path.resolve(__dirname, "..", "public")
    : path.join(process.cwd(), "public");
if (fs.existsSync(PUBLIC_DIR)) {
    const UI_PATHS = new Set([
        "",
        "/",
        "/assistant",
        "/assistant/chat",
        "/login",
        "/signup",
        "/account",
        "/account/models",
        "/projects/view",
        "/projects/view/chat",
        "/projects/view/review",
        "/tabular-reviews/view",
        "/workflows/view",
    ]);
    const SAFE_PATH_RE = /[^a-zA-Z0-9/_\-.]/g;
    app.get("*", (req, res, next) => {
        if (req.path.startsWith("/api/")) return next();
        let clean: string;
        try {
            clean = decodeURIComponent(req.path)
                .replace(/\.\./g, "")
                .replace(SAFE_PATH_RE, "");
        } catch {
            return next();
        }
        const normalized =
            clean !== "/" && clean.endsWith("/") ? clean.slice(0, -1) : clean;
        const candidates = [
            path.join(PUBLIC_DIR, normalized, "index.html"),
            path.join(PUBLIC_DIR, `${normalized}.html`),
            path.join(PUBLIC_DIR, normalized),
        ];
        for (const file of candidates) {
            try {
                if (fs.statSync(file).isFile()) return res.sendFile(file);
            } catch {
                // not a file, try the next candidate
            }
        }
        if (UI_PATHS.has(normalized)) {
            return res.sendFile(path.join(PUBLIC_DIR, "index.html"));
        }
        return next();
    });
}

app.use("/chat", chatRouter);
app.use("/projects", projectsRouter);
app.use("/projects/:projectId/chat", projectChatRouter);
app.use("/single-documents", documentsRouter);
app.use("/tabular-review", tabularRouter);
app.use("/workflows", workflowsRouter);
app.use("/user", userRouter);
app.use("/users", userRouter);
app.use("/download", downloadsRouter);

app.get("/health", (_req, res) => res.json({ ok: true }));

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Mike backend running on port ${PORT}`);
});
