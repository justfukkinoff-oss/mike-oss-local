# MikeOSS on Android — Standalone APK

This repo builds a **100% standalone MikeOSS Android APK**: one Express server
embedded via the nodejs-mobile Node runtime, one Capacitor WebView, no
LibreOffice, no PDF conversion — `.docx` files are stored, edited, and
exported natively.

```
┌──────────────────────────── Android app ────────────────────────────┐
│  Capacitor WebView  ──http──▶  http://127.0.0.1:3001 (Express)      │
│        ▲                                     ▲                      │
│        │ server.url                          │ embedded in          │
│        │                                     │ libnode.so thread    │
│  error.html splash (retries until server is up)                     │
└──────────────────────────────────────────────────────────────────────┘
```

## What was ported

1. **LibreOffice & PDF conversion removed** — `libreoffice-convert` is gone
   from `backend/`. Upload, versioning, and export all keep `.docx` bytes
   as `.docx` and serve
   `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
   directly. Text extraction for AI context uses only pure-JS paths
   (`mammoth`, `jszip` + XML parsing) — no native binaries required.
   `pdfjs-dist` is kept purely for *reading* uploaded PDFs (also pure JS).
2. **OpenRouter + NVIDIA NIM providers** — both speak the OpenAI Chat
   Completions schema; a single adapter
   (`backend/src/lib/llm/openaiCompat.ts`) drives them with the standard
   `openai` SDK. Models are addressed with a provider prefix, e.g.
   `openrouter/anthropic/claude-3.5-sonnet` or
   `nvidia/meta/llama-3.3-70b-instruct`. The model dropdown
   (`frontend/src/app/components/assistant/ModelToggle.tsx`) has new
   *OpenRouter* and *NVIDIA NIM* groups with free-text custom model ids, and
   the account → models page accepts keys for both providers (or set them in
   `backend/.env` as `OPENROUTER_API_KEY` / `NVIDIA_API_KEY`).
3. **Static frontend served by Express** — `frontend` builds with
   `output: "export"` into `frontend/out`, copied to `backend/public`, and
   served by the same Express process (see `backend/src/index.ts`). Dynamic
   client-side routes now use query params (`/assistant/chat?id=…`,
   `/projects/view?id=…`, `/projects/view/chat?project=…&chatId=…`,
   `/workflows/view?id=…`, `/tabular-reviews/view?id=…`) because Next.js
   static export cannot emit per-id pages.
4. **Android shell** — Capacitor project in `android/` plus a JNI wrapper
   (`android/app/src/main/java/com/local/mikeoss/nodejs/NodeJsMobile.java`
   and `android/app/src/main/cpp/native-lib.cpp`) that starts
   `dist/index.js` with libnode.so from
   [nodejs-mobile](https://github.com/nodejs-mobile/nodejs-mobile) v18.20.4.

## Build the APK

Requirements on your build machine: Node 20+, JDK 21, Android SDK (Studio is
easiest). The backend is pure-JS, so nothing needs cross-compiling.

```bash
# one-time: stage assets + runtime (builds backend & frontend too)
npm install          # root, for Capacitor CLI
npm run android:prepare

# build
npm run android:build          # release (unsigned)
# or open in Android Studio: npm run android:open → Run ▶
```

Output: `android/app/build/outputs/apk/debug/app-debug.apk` (debug build via
Studio) or `.../release/app-release-unsigned.apk`. Sign the release APK with
`apksigner` before installing on devices.

### What the prepare script does

- `npm run build` in `backend/` → `backend/dist`
- `npm run export` in `frontend/` → copied to `backend/public/` (+ an
  `error.html` retry splash) and synced into the WebView assets
- copies `dist/`, `node_modules/`, `public/`, `package.json`, `.env` into
  `android/app/src/main/assets/nodejs-project/`
- installs `libnode.so` (arm64-v8a, armeabi-v7a, x86_64) into
  `android/app/src/main/jniLibs/` and the Node headers into
  `android/app/libnode-include/` for the CMake JNI build

Re-run `npm run android:prepare` whenever backend/frontend code changes.

## Runtime behavior on device

- On launch `MainActivity` starts Node with
  `dist/index.js` on a background thread. First boot copies the whole
  `nodejs-project` bundle from APK assets into internal storage
  (`context.getFilesDir()`); the copy is refreshed when the APK updates.
- Data lives in app-private storage: JSON database at
  `files/mike-data/local-db.json`, document bytes under
  `files/mike-data/storage/` (pinned via `LOCAL_DATA_DIR`/`LOCAL_STORAGE_DIR`
  in `NodeJsMobile.java`).
- The WebView points at `http://127.0.0.1:3001` (`cleartext: true`, confined
  to loopback). Until Express is ready, Capacitor serves `error.html`, which
  polls and redirects as soon as `/` responds.
- API keys for OpenRouter / NVIDIA / Anthropic / Gemini can be set in the app
  (Account → Models) or pre-baked in `backend/.env` before packaging.

## Desktop development still works

```bash
npm install --prefix backend && npm run dev --prefix backend
npm install --prefix frontend && npm run dev --prefix frontend
```

The frontend auto-detects its origin: when you run it from the Express
server (APK mode) it calls the API same-origin; on `localhost:3000` dev mode
it still targets `http://localhost:3001`.
