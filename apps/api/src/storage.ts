import { createHash, randomUUID } from "crypto";
import bs58 from "bs58";
import { env, hasSupabaseConfig } from "./env";

export type UserRole = "player" | "organizer" | "admin";
export type OrganizerStatus = "none" | "pending" | "approved" | "rejected";
export type OrganizerApplicationStatus = "pending" | "approved" | "rejected";

export type UserRecord = {
  id: string;
  wallet_address: string;
  username: string;
  password_hash: string ;
  display_name: string ;
  role: UserRole;
  organizer_status: OrganizerStatus;
  created_at: string;
  updated_at: string;
};

export type AuthChallengeRecord = {
  id: string;
  wallet_address: string;
  nonce: string;
  message: string;
  expires_at: string;
  is_consumed: boolean;
  consumed_at: string | null;
  created_at: string;
};

export type SessionRecord = {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  created_at: string;
  last_seen_at: string;
};

export type OrganizerApplicationRecord = {
  id: string;
  user_id: string;
  status: OrganizerApplicationStatus;
  reason: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type OrganizerApplicationUpsert = Pick<
  OrganizerApplicationRecord,
  "user_id" | "reason" | "status"
> &
  Partial<Pick<OrganizerApplicationRecord, "reviewed_by" | "reviewed_at">>;

export type SessionWithUser = {
  session: SessionRecord;
  user: UserRecord;
};

export type StorageAdapter = {
  createChallenge(
    record: Omit<AuthChallengeRecord, "id" | "created_at" | "is_consumed" | "consumed_at">
  ): Promise<AuthChallengeRecord>;
  findValidChallenge(walletAddress: string, nonce: string, nowIso: string): Promise<AuthChallengeRecord | null>;
  consumeChallenge(id: string, consumedAtIso: string): Promise<void>;
  findUserByWallet(walletAddress: string): Promise<UserRecord | null>;
  findUserByUsername(username: string): Promise<UserRecord | null>;
  findUserById(userId: string): Promise<UserRecord | null>;
  createUser(record: Pick<UserRecord, "wallet_address" | "username" | "password_hash" | "display_name" | "role" | "organizer_status">): Promise<UserRecord>;
  updateUserProfile(
    userId: string,
    updates: Partial<Pick<UserRecord, "username" | "password_hash" | "display_name" | "role" | "organizer_status">>
  ): Promise<UserRecord>;
  createSession(record: Omit<SessionRecord, "id" | "created_at" | "last_seen_at">): Promise<SessionRecord>;
  getSessionByTokenHash(tokenHash: string, nowIso: string): Promise<SessionWithUser | null>;
  deleteSession(tokenHash: string): Promise<void>;
  upsertOrganizerApplication(
    record: OrganizerApplicationUpsert
  ): Promise<OrganizerApplicationRecord>;
  listOrganizerApplications(): Promise<OrganizerApplicationRecord[]>;
  getOrganizerApplicationById(id: string): Promise<OrganizerApplicationRecord | null>;
};

function nowIso() {
  return new Date().toISOString();
}

function normalizeStoredWalletAddress(walletAddress: string) {
  return bs58.encode(bs58.decode(walletAddress.trim()));
}

function sortByNewest<T extends { created_at: string }>(records: T[]) {
  return [...records].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

class MemoryStorage implements StorageAdapter {
  private challenges = new Map<string, AuthChallengeRecord>();
  private users = new Map<string, UserRecord>();
  private usersById = new Map<string, UserRecord>();
  private usersByUsername = new Map<string, UserRecord>();
  private sessions = new Map<string, SessionRecord>();
  private organizerApplications = new Map<string, OrganizerApplicationRecord>();

  async createChallenge(
    record: Omit<AuthChallengeRecord, "id" | "created_at" | "is_consumed" | "consumed_at">
  ) {
    const created: AuthChallengeRecord = {
      id: randomUUID(),
      created_at: nowIso(),
      is_consumed: false,
      consumed_at: null,
      ...record,
    };
    this.challenges.set(created.id, created);
    return created;
  }

  async findValidChallenge(walletAddress: string, nonce: string, now: string) {
    return (
      [...this.challenges.values()].find(
        (challenge) =>
          challenge.wallet_address === walletAddress &&
          challenge.nonce === nonce &&
          !challenge.is_consumed &&
          challenge.expires_at > now
      ) ?? null
    );
  }

  async consumeChallenge(id: string, consumedAtIso: string) {
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

  async findUserByWallet(walletAddress: string) {
    return this.users.get(normalizeStoredWalletAddress(walletAddress)) ?? null;
  }

  async findUserByUsername(username: string) {
    return this.usersByUsername.get(username.trim().toLowerCase()) ?? null;
  }

  async findUserById(userId: string) {
    return this.usersById.get(userId) ?? null;
  }

  async createUser(
    record: Pick<
      UserRecord,
      "wallet_address" | "username" | "password_hash" | "display_name" | "role" | "organizer_status"
    >
  ) {
    const created: UserRecord = {
      id: randomUUID(),
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

  async updateUserProfile(
    userId: string,
    updates: Partial<
      Pick<UserRecord, "username" | "password_hash" | "display_name" | "role" | "organizer_status">
    >
  ) {
    const current = this.usersById.get(userId);
    if (!current) {
      throw new Error("User not found.");
    }

    const updated: UserRecord = {
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

  async createSession(record: Omit<SessionRecord, "id" | "created_at" | "last_seen_at">) {
    const created: SessionRecord = {
      id: randomUUID(),
      created_at: nowIso(),
      last_seen_at: nowIso(),
      ...record,
    };
    this.sessions.set(created.token_hash, created);
    return created;
  }

  async getSessionByTokenHash(tokenHash: string, now: string) {
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

  async deleteSession(tokenHash: string) {
    this.sessions.delete(tokenHash);
  }

  async upsertOrganizerApplication(
    record: OrganizerApplicationUpsert
  ) {
    const existing = [...this.organizerApplications.values()].find(
      (application) => application.user_id === record.user_id
    );

    if (existing) {
      const updated: OrganizerApplicationRecord = {
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

    const created: OrganizerApplicationRecord = {
      id: randomUUID(),
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

  async getOrganizerApplicationById(id: string) {
    return this.organizerApplications.get(id) ?? null;
  }
}

type SupabaseMethod = "GET" | "POST" | "PATCH";

class SupabaseStorage implements StorageAdapter {
  constructor(
    private readonly baseUrl: string,
    private readonly serviceRoleKey: string
  ) {}

  private async request<T>(
    path: string,
    method: SupabaseMethod,
    options?: { body?: unknown; prefer?: string }
  ) {
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
      return null as T;
    }

    return (await response.json()) as T;
  }

  private query(table: string, filters: Record<string, string>) {
    const params = new URLSearchParams();
    params.set("select", "*");

    for (const [key, value] of Object.entries(filters)) {
      params.set(key, value);
    }

    return `${table}?${params.toString()}`;
  }

  async createChallenge(
    record: Omit<AuthChallengeRecord, "id" | "created_at" | "is_consumed" | "consumed_at">
  ) {
    const [created] = await this.request<AuthChallengeRecord[]>("auth_challenges", "POST", {
      body: record,
    });
    return created;
  }

  async findValidChallenge(walletAddress: string, nonce: string, now: string) {
    const path = this.query("auth_challenges", {
      wallet_address: `eq.${walletAddress}`,
      nonce: `eq.${nonce}`,
      is_consumed: "eq.false",
      expires_at: `gt.${now}`,
      order: "created_at.desc",
      limit: "1",
    });
    const rows = await this.request<AuthChallengeRecord[]>(path, "GET");
    return rows[0] ?? null;
  }

  async consumeChallenge(id: string, consumedAtIso: string) {
    await this.request<null>(`auth_challenges?id=eq.${id}`, "PATCH", {
      body: { is_consumed: true, consumed_at: consumedAtIso },
      prefer: "return=minimal",
    });
  }

  async findUserByWallet(walletAddress: string) {
    const path = this.query("users", {
      wallet_address: `eq.${walletAddress}`,
      limit: "1",
    });
    const rows = await this.request<UserRecord[]>(path, "GET");
    return rows[0] ?? null;
  }

  async findUserByUsername(username: string) {
    const path = this.query("users", {
      username: `eq.${username.trim().toLowerCase()}`,
      limit: "1",
    });
    const rows = await this.request<UserRecord[]>(path, "GET");
    return rows[0] ?? null;
  }

  async createUser(
    record: Pick<
      UserRecord,
      "wallet_address" | "username" | "password_hash" | "display_name" | "role" | "organizer_status"
    >
  ) {
    const [created] = await this.request<UserRecord[]>("users", "POST", {
      body: record,
    });
    return created;
  }

  async updateUserProfile(
    userId: string,
    updates: Partial<
      Pick<UserRecord, "username" | "password_hash" | "display_name" | "role" | "organizer_status">
    >
  ) {
    const [updated] = await this.request<UserRecord[]>(`users?id=eq.${userId}`, "PATCH", {
      body: updates,
    });
    return updated;
  }

  async createSession(record: Omit<SessionRecord, "id" | "created_at" | "last_seen_at">) {
    const [created] = await this.request<SessionRecord[]>("sessions", "POST", {
      body: record,
    });
    return created;
  }

  async getSessionByTokenHash(tokenHash: string, now: string) {
    const path = this.query("sessions", {
      token_hash: `eq.${tokenHash}`,
      expires_at: `gt.${now}`,
      limit: "1",
    });
    const rows = await this.request<SessionRecord[]>(path, "GET");
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

  async findUserById(userId: string) {
    const path = this.query("users", { id: `eq.${userId}`, limit: "1" });
    const rows = await this.request<UserRecord[]>(path, "GET");
    return rows[0] ?? null;
  }

  async deleteSession(tokenHash: string) {
    await this.request<null>(`sessions?token_hash=eq.${tokenHash}`, "PATCH", {
      body: { expires_at: new Date(0).toISOString() },
      prefer: "return=minimal",
    });
  }

  async upsertOrganizerApplication(
    record: OrganizerApplicationUpsert
  ) {
    const existing = await this.findOrganizerApplicationByUserId(record.user_id);

    if (existing) {
      const [updated] = await this.request<OrganizerApplicationRecord[]>(
        `organizer_apps?id=eq.${existing.id}`,
        "PATCH",
        {
          body: {
            reason: record.reason,
            status: record.status,
            reviewed_by: record.reviewed_by ?? null,
            reviewed_at: record.reviewed_at ?? null,
          },
        }
      );
      return updated;
    }

    const [created] = await this.request<OrganizerApplicationRecord[]>(
      "organizer_apps",
      "POST",
      {
        body: record,
      }
    );
    return created;
  }

  private async findOrganizerApplicationByUserId(userId: string) {
    const path = this.query("organizer_apps", {
      user_id: `eq.${userId}`,
      limit: "1",
    });
    const rows = await this.request<OrganizerApplicationRecord[]>(path, "GET");
    return rows[0] ?? null;
  }

  async listOrganizerApplications() {
    const path = this.query("organizer_apps", { order: "created_at.desc" });
    return this.request<OrganizerApplicationRecord[]>(path, "GET");
  }

  async getOrganizerApplicationById(id: string) {
    const path = this.query("organizer_apps", { id: `eq.${id}`, limit: "1" });
    const rows = await this.request<OrganizerApplicationRecord[]>(path, "GET");
    return rows[0] ?? null;
  }
}

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function createStorage(): StorageAdapter {
  if (hasSupabaseConfig()) {
    return new SupabaseStorage(
      env.supabaseUrl!,
      env.supabaseServiceRoleKey!
    );
  }

  return new MemoryStorage();
}
