import dotenv from "dotenv";
import path from "path";

// Load the repo-level .env (desktop dev) without clobbering variables that
// were already set in the process — on Android the embedded-runtime wrapper
// (NodeJsMobile.java) pins LOCAL_DATA_DIR/LOCAL_STORAGE_DIR to app-internal
// storage, and those must win over the packaged .env defaults.
dotenv.config({
  path: path.resolve(__dirname, "..", "..", "..", ".env"),
  quiet: true,
});
dotenv.config({
  path: path.resolve(__dirname, "..", "..", ".env"),
  override: false,
  quiet: true,
});
