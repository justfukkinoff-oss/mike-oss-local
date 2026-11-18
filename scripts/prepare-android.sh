#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# MikeOSS Android packaging prep (run from the repo root, before gradle).
#
# 1. Builds the backend (TypeScript -> dist/) and the frontend (static export)
# 2. Copies the static UI into backend/public and syncs it into the WebView
#    assets
# 3. Stages the entire Node backend (dist/, node_modules/, public/, .env) into
#    android/app/src/main/assets/nodejs-project/
# 4. Downloads nodejs-mobile v18.20.4 and installs libnode.so + Node headers
#    into the Android app module
# ---------------------------------------------------------------------------
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

NODEJS_MOBILE_VERSION="18.20.4"
NODEJS_MOBILE_PKG="nodejs-mobile-react-native-${NODEJS_MOBILE_VERSION}"
NODEJS_MOBILE_TGZ="/tmp/${NODEJS_MOBILE_PKG}.tgz"
NODEJS_MOBILE_DIR="/tmp/${NODEJS_MOBILE_PKG}"

echo "==> [1/5] Backend: install + build"
npm install --prefix backend --no-audit --no-fund
npm run build --prefix backend

echo "==> [2/5] Frontend: install + static export"
npm install --prefix frontend --no-audit --no-fund
rm -rf frontend/.next frontend/out
NEXT_TELEMETRY_DISABLED=1 npm run export --prefix frontend

echo "==> [3/5] Copy static UI to backend/public"
rm -rf backend/public
mkdir -p backend/public
cp -r frontend/out/. backend/public/
cp scripts/assets/error.html backend/public/error.html

echo "==> [4/5] Stage nodejs-project into android assets"
ASSETS_DIR="android/app/src/main/assets"
rm -rf "${ASSETS_DIR}/nodejs-project"
mkdir -p "${ASSETS_DIR}/nodejs-project"
cp -r backend/dist "${ASSETS_DIR}/nodejs-project/dist"
cp -r backend/public "${ASSETS_DIR}/nodejs-project/public"
cp -r backend/node_modules "${ASSETS_DIR}/nodejs-project/node_modules"
cp backend/package.json "${ASSETS_DIR}/nodejs-project/package.json"
if [ -f backend/.env ]; then
  cp backend/.env "${ASSETS_DIR}/nodejs-project/.env"
else
  cp backend/.env.example "${ASSETS_DIR}/nodejs-project/.env"
fi
# node_modules include Android-incompatible prebuilt binaries? None: the
# backend is pure-JS (mammoth/jszip/pdfjs). Belt-and-braces: drop any .node
# native modules that would only work on desktop.
find "${ASSETS_DIR}/nodejs-project/node_modules" -name "*.node" -delete || true

echo "==> [5/5] Install nodejs-mobile libnode.so + headers"
if [ ! -f "${NODEJS_MOBILE_TGZ}" ]; then
  npm pack "nodejs-mobile-react-native@${NODEJS_MOBILE_VERSION}" --pack-destination /tmp
fi
rm -rf "${NODEJS_MOBILE_DIR}"
mkdir -p "${NODEJS_MOBILE_DIR}"
tar xzf "${NODEJS_MOBILE_TGZ}" -C "${NODEJS_MOBILE_DIR}"

JNI_DIR="android/app/src/main/jniLibs"
rm -rf "${JNI_DIR}"
for ABI in arm64-v8a armeabi-v7a x86_64; do
  mkdir -p "${JNI_DIR}/${ABI}"
  cp "${NODEJS_MOBILE_DIR}/package/android/libnode/bin/${ABI}/libnode.so" "${JNI_DIR}/${ABI}/libnode.so"
done

INCLUDE_DIR="android/app/libnode-include"
rm -rf "${INCLUDE_DIR}"
mkdir -p "${INCLUDE_DIR}"
cp -r "${NODEJS_MOBILE_DIR}/package/android/libnode/include/node" "${INCLUDE_DIR}/node"

echo "==> Syncing WebView assets (cap sync)"
npx cap sync android

echo ""
echo "Done. Build the APK with:"
echo "  cd android && ./gradlew assembleDebug"
