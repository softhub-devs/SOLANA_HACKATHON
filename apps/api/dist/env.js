"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
exports.hasSupabaseConfig = hasSupabaseConfig;
const fs_1 = require("fs");
const path_1 = require("path");
function parseEnvFile(path) {
    if (!(0, fs_1.existsSync)(path)) {
        return {};
    }
    const contents = (0, fs_1.readFileSync)(path, "utf8");
    const result = {};
    for (const rawLine of contents.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) {
            continue;
        }
        const separatorIndex = line.indexOf("=");
        if (separatorIndex <= 0) {
            continue;
        }
        const key = line.slice(0, separatorIndex).trim();
        let value = line.slice(separatorIndex + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        result[key] = value;
    }
    return result;
}
function loadEnvFiles() {
    const root = (0, path_1.resolve)(__dirname, "..");
    const files = [(0, path_1.resolve)(root, ".env.local"), (0, path_1.resolve)(root, "..", "..", ".env")];
    for (const path of files) {
        const parsed = parseEnvFile(path);
        for (const [key, value] of Object.entries(parsed)) {
            if (process.env[key] === undefined) {
                process.env[key] = value;
            }
        }
    }
}
loadEnvFiles();
function optionalEnv(name) {
    const value = process.env[name]?.trim();
    return value ? value : undefined;
}
exports.env = {
    port: Number(process.env.PORT ?? 4000),
    webOrigin: process.env.WEB_ORIGIN?.trim() || "http://localhost:3000",
    sessionCookieName: process.env.SESSION_COOKIE_NAME?.trim() || "gamechain_session",
    sessionTtlMs: Number(process.env.SESSION_TTL_MS ?? 7 * 24 * 60 * 60 * 1000),
    challengeTtlMs: Number(process.env.CHALLENGE_TTL_MS ?? 5 * 60 * 1000),
    secureCookies: process.env.NODE_ENV === "production",
    supabaseUrl: optionalEnv("SUPABASE_URL"),
    supabaseServiceRoleKey: optionalEnv("SUPABASE_SERVICE_ROLE_KEY"),
    adminUsername: process.env.ADMIN_USERNAME?.trim().toLowerCase() || "admin",
    adminPassword: process.env.ADMIN_PASSWORD?.trim() || "changeme123",
    adminDisplayName: process.env.ADMIN_DISPLAY_NAME?.trim() || "GameChain Admin",
};
function hasSupabaseConfig() {
    return Boolean(exports.env.supabaseUrl && exports.env.supabaseServiceRoleKey);
}
