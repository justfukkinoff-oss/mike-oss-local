// Single source of truth for the backend API base URL.
// - Explicit env override always wins.
// - In the Android APK the WebView is served by the embedded Express server
//   itself, so same-origin (`""`) is used.
// - Desktop dev mode (Next on :3000, Express on :3001) keeps the old default.
export function resolveApiBase(): string {
    const env = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (env && env.trim()) return env.trim().replace(/\/$/, "");
    if (typeof window !== "undefined") {
        const { protocol, hostname, port } = window.location;
        if (hostname === "localhost" && port === "3000") {
            return "http://localhost:3001";
        }
        return `${protocol}//${hostname}${port ? `:${port}` : ""}`;
    }
    return "http://localhost:3001";
}
