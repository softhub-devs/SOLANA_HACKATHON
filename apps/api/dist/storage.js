"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sha256 = sha256;
exports.createStorage = createStorage;
const crypto_1 = require("crypto");
const bs58_1 = __importDefault(require("bs58"));
const env_1 = require("./env");
function nowIso() {
    return new Date().toISOString();
}
function normalizeStoredWalletAddress(walletAddress) {
    return bs58_1.default.encode(bs58_1.default.decode(walletAddress.trim()));
}
function sortByNewest(records) {
    return [...records].sort((a, b) => b.created_at.localeCompare(a.created_at));
}
class MemoryStorage {
    challenges = new Map();
    users = new Map();
    usersById = new Map();
    usersByUsername = new Map();
    sessions = new Map();
    organizerApplications = new Map();
    async createChallenge(record) {
        const created = {
            id: (0, crypto_1.randomUUID)(),
            created_at: nowIso(),
            is_consumed: false,
            consumed_at: null,
            ...record,
        };
        this.challenges.set(created.id, created);
        return created;
    }
    async findValidChallenge(walletAddress, nonce, now) {
        return ([...this.challenges.values()].find((challenge) => challenge.wallet_address === walletAddress &&
            challenge.nonce === nonce &&
            !challenge.is_consumed &&
            challenge.expires_at > now) ?? null);
    }
    async consumeChallenge(id, consumedAtIso) {
        const current = this.challenges.get(id);
        if (!current) {
            return;
        }
        this.challenges.set(id, {
            ...current,
            is_consumed: true,
            consumed_at: consumedAtIso,
        });
    }
    async findUserByWallet(walletAddress) {
        return this.users.get(normalizeStoredWalletAddress(walletAddress)) ?? null;
    }
    async findUserByUsername(username) {
        return this.usersByUsername.get(username.trim().toLowerCase()) ?? null;
    }
    async findUserById(userId) {
        return this.usersById.get(userId) ?? null;
    }
    async createUser(record) {
        const created = {
            id: (0, crypto_1.randomUUID)(),
            created_at: nowIso(),
            updated_at: nowIso(),
            ...record,
        };
        this.users.set(normalizeStoredWalletAddress(created.wallet_address), created);
        this.usersById.set(created.id, created);
        if (created.username) {
            this.usersByUsername.set(created.username, created);
        }
        return created;
    }
    async updateUserProfile(userId, updates) {
        const current = this.usersById.get(userId);
        if (!current) {
            throw new Error("User not found.");
        }
        const updated = {
            ...current,
            ...updates,
            updated_at: nowIso(),
        };
        if (current.username && current.username !== updated.username) {
            this.usersByUsername.delete(current.username);
        }
        this.users.set(normalizeStoredWalletAddress(updated.wallet_address), updated);
        this.usersById.set(updated.id, updated);
        if (updated.username) {
            this.usersByUsername.set(updated.username, updated);
        }
        return updated;
    }
    async createSession(record) {
        const created = {
            id: (0, crypto_1.randomUUID)(),
            created_at: nowIso(),
            last_seen_at: nowIso(),
            ...record,
        };
        this.sessions.set(created.token_hash, created);
        return created;
    }
    async getSessionByTokenHash(tokenHash, now) {
        const session = this.sessions.get(tokenHash);
        if (!session || session.expires_at <= now) {
            return null;
        }
        const user = this.usersById.get(session.user_id);
        if (!user) {
            return null;
        }
        return { session, user };
    }
    async deleteSession(tokenHash) {
        this.sessions.delete(tokenHash);
    }
    async upsertOrganizerApplication(record) {
        const existing = [...this.organizerApplications.values()].find((application) => application.user_id === record.user_id);
        if (existing) {
            const updated = {
                ...existing,
                reason: record.reason,
                status: record.status,
                reviewed_at: record.reviewed_at ?? null,
                reviewed_by: record.reviewed_by ?? null,
                updated_at: nowIso(),
            };
            this.organizerApplications.set(updated.id, updated);
            return updated;
        }
        const created = {
            id: (0, crypto_1.randomUUID)(),
            reviewed_at: record.reviewed_at ?? null,
            reviewed_by: record.reviewed_by ?? null,
            created_at: nowIso(),
            updated_at: nowIso(),
            ...record,
        };
        this.organizerApplications.set(created.id, created);
        return created;
    }
    async listOrganizerApplications() {
        return sortByNewest([...this.organizerApplications.values()]);
    }
    async getOrganizerApplicationById(id) {
        return this.organizerApplications.get(id) ?? null;
    }
}
class SupabaseStorage {
    baseUrl;
    serviceRoleKey;
    constructor(baseUrl, serviceRoleKey) {
        this.baseUrl = baseUrl;
        this.serviceRoleKey = serviceRoleKey;
    }
    async request(path, method, options) {
        const response = await fetch(`${this.baseUrl}/rest/v1/${path}`, {
            method,
            headers: {
                "Content-Type": "application/json",
                apikey: this.serviceRoleKey,
                Authorization: `Bearer ${this.serviceRoleKey}`,
                Prefer: options?.prefer ?? "return=representation",
            },
            body: options?.body ? JSON.stringify(options.body) : undefined,
        });
        if (!response.ok) {
            const payload = await response.text();
            throw new Error(`Supabase request failed: ${response.status} ${payload}`);
        }
        if (response.status === 204) {
            return null;
        }
        return (await response.json());
    }
    query(table, filters) {
        const params = new URLSearchParams();
        params.set("select", "*");
        for (const [key, value] of Object.entries(filters)) {
            params.set(key, value);
        }
        return `${table}?${params.toString()}`;
    }
    async createChallenge(record) {
        const [created] = await this.request("auth_challenges", "POST", {
            body: record,
        });
        return created;
    }
    async findValidChallenge(walletAddress, nonce, now) {
        const path = this.query("auth_challenges", {
            wallet_address: `eq.${walletAddress}`,
            nonce: `eq.${nonce}`,
            is_consumed: "eq.false",
            expires_at: `gt.${now}`,
            order: "created_at.desc",
            limit: "1",
        });
        const rows = await this.request(path, "GET");
        return rows[0] ?? null;
    }
    async consumeChallenge(id, consumedAtIso) {
        await this.request(`auth_challenges?id=eq.${id}`, "PATCH", {
            body: { is_consumed: true, consumed_at: consumedAtIso },
            prefer: "return=minimal",
        });
    }
    async findUserByWallet(walletAddress) {
        const path = this.query("users", {
            wallet_address: `eq.${walletAddress}`,
            limit: "1",
        });
        const rows = await this.request(path, "GET");
        return rows[0] ?? null;
    }
    async findUserByUsername(username) {
        const path = this.query("users", {
            username: `eq.${username.trim().toLowerCase()}`,
            limit: "1",
        });
        const rows = await this.request(path, "GET");
        return rows[0] ?? null;
    }
    async createUser(record) {
        const [created] = await this.request("users", "POST", {
            body: record,
        });
        return created;
    }
    async updateUserProfile(userId, updates) {
        const [updated] = await this.request(`users?id=eq.${userId}`, "PATCH", {
            body: updates,
        });
        return updated;
    }
    async createSession(record) {
        const [created] = await this.request("sessions", "POST", {
            body: record,
        });
        return created;
    }
    async getSessionByTokenHash(tokenHash, now) {
        const path = this.query("sessions", {
            token_hash: `eq.${tokenHash}`,
            expires_at: `gt.${now}`,
            limit: "1",
        });
        const rows = await this.request(path, "GET");
        const session = rows[0];
        if (!session) {
            return null;
        }
        const user = await this.findUserById(session.user_id);
        if (!user) {
            return null;
        }
        return { session, user };
    }
    async findUserById(userId) {
        const path = this.query("users", { id: `eq.${userId}`, limit: "1" });
        const rows = await this.request(path, "GET");
        return rows[0] ?? null;
    }
    async deleteSession(tokenHash) {
        await this.request(`sessions?token_hash=eq.${tokenHash}`, "PATCH", {
            body: { expires_at: new Date(0).toISOString() },
            prefer: "return=minimal",
        });
    }
    async upsertOrganizerApplication(record) {
        const existing = await this.findOrganizerApplicationByUserId(record.user_id);
        if (existing) {
            const [updated] = await this.request(`organizer_apps?id=eq.${existing.id}`, "PATCH", {
                body: {
                    reason: record.reason,
                    status: record.status,
                    reviewed_by: record.reviewed_by ?? null,
                    reviewed_at: record.reviewed_at ?? null,
                },
            });
            return updated;
        }
        const [created] = await this.request("organizer_apps", "POST", {
            body: record,
        });
        return created;
    }
    async findOrganizerApplicationByUserId(userId) {
        const path = this.query("organizer_apps", {
            user_id: `eq.${userId}`,
            limit: "1",
        });
        const rows = await this.request(path, "GET");
        return rows[0] ?? null;
    }
    async listOrganizerApplications() {
        const path = this.query("organizer_apps", { order: "created_at.desc" });
        return this.request(path, "GET");
    }
    async getOrganizerApplicationById(id) {
        const path = this.query("organizer_apps", { id: `eq.${id}`, limit: "1" });
        const rows = await this.request(path, "GET");
        return rows[0] ?? null;
    }
}
function sha256(value) {
    return (0, crypto_1.createHash)("sha256").update(value).digest("hex");
}
function createStorage() {
    if ((0, env_1.hasSupabaseConfig)()) {
        return new SupabaseStorage(env_1.env.supabaseUrl, env_1.env.supabaseServiceRoleKey);
    }
    return new MemoryStorage();
}
