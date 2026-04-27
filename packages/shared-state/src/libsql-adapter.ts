import { createEntityId, nowIso } from "@apex/shared-types";
import type {
  LibSQLConnectionConfig,
  LibSQLQuery,
  LibSQLBatchStep,
  LibSQLResult,
  LibSQLMigration,
  LibSQLMigrationRecord,
  LibSQLHealthCheck,
  LibSQLSyncStatus
} from "./libsql-types.js";

export type {
  LibSQLConnectionConfig,
  LibSQLQuery,
  LibSQLBatchStep,
  LibSQLResult,
  LibSQLMigration,
  LibSQLMigrationRecord,
  LibSQLHealthCheck,
  LibSQLSyncStatus
} from "./libsql-types.js";

export interface PersistenceAdapter {
  execute(query: LibSQLQuery): Promise<LibSQLResult>;
  batch(steps: LibSQLBatchStep[]): Promise<LibSQLResult[]>;
  transaction<T>(fn: (adapter: PersistenceAdapter) => Promise<T>): Promise<T>;
  healthCheck(): Promise<LibSQLHealthCheck>;
  close(): void;
}

export class InMemoryPersistenceAdapter implements PersistenceAdapter {
  private readonly tables = new Map<string, Map<string, Record<string, unknown>>>();
  private readonly autoIncrementCounters = new Map<string, number>();
  private readonly migrations = new Map<number, LibSQLMigrationRecord>();

  async execute(query: LibSQLQuery): Promise<LibSQLResult> {
    const sql = query.sql.trim();

    if (sql.toUpperCase().startsWith("SELECT")) {
      return this.executeSelect(sql, query.args);
    }
    if (sql.toUpperCase().startsWith("INSERT")) {
      return this.executeInsert(sql, query.args);
    }
    if (sql.toUpperCase().startsWith("UPDATE")) {
      return this.executeUpdate(sql, query.args);
    }
    if (sql.toUpperCase().startsWith("DELETE")) {
      return this.executeDelete(sql, query.args);
    }
    if (sql.toUpperCase().startsWith("CREATE TABLE")) {
      this.executeCreateTable(sql);
      return { rows: [], columns: [], rows_affected: 0, last_insert_rowid: null };
    }
    if (sql.toUpperCase().startsWith("CREATE INDEX") || sql.toUpperCase().startsWith("CREATE UNIQUE INDEX")) {
      return { rows: [], columns: [], rows_affected: 0, last_insert_rowid: null };
    }
    if (sql.toUpperCase().startsWith("DROP TABLE")) {
      const tableName = this.extractTableName(sql, "DROP TABLE");
      this.tables.delete(tableName);
      return { rows: [], columns: [], rows_affected: 0, last_insert_rowid: null };
    }

    return { rows: [], columns: [], rows_affected: 0, last_insert_rowid: null };
  }

  async batch(steps: LibSQLBatchStep[]): Promise<LibSQLResult[]> {
    const results: LibSQLResult[] = [];
    for (const step of steps) {
      results.push(await this.execute(step));
    }
    return results;
  }

  async transaction<T>(fn: (adapter: PersistenceAdapter) => Promise<T>): Promise<T> {
    return fn(this);
  }

  async healthCheck(): Promise<LibSQLHealthCheck> {
    return {
      connected: true,
      url: "in-memory",
      latency_ms: 0,
      version: "0.1.0-inmemory",
      is_replica: false
    };
  }

  close(): void {}

  async runMigrations(migrations: LibSQLMigration[]): Promise<LibSQLMigrationRecord[]> {
    const applied: LibSQLMigrationRecord[] = [];
    const sorted = [...migrations].sort((a, b) => a.version - b.version);

    for (const migration of sorted) {
      if (this.migrations.has(migration.version)) continue;

      const statements = migration.up.split(";").map(s => s.trim()).filter(s => s.length > 0);
      for (const stmt of statements) {
        await this.execute({ sql: stmt });
      }

      const record: LibSQLMigrationRecord = {
        version: migration.version,
        name: migration.name,
        applied_at: nowIso()
      };
      this.migrations.set(migration.version, record);
      applied.push(record);
    }

    return applied;
  }

  async getAppliedMigrations(): Promise<LibSQLMigrationRecord[]> {
    return [...this.migrations.values()].sort((a, b) => a.version - b.version);
  }

  getSyncStatus(): LibSQLSyncStatus {
    return {
      last_sync_at: nowIso(),
      frames_applied: 0,
      sync_url: "",
      is_replica: false
    };
  }

  private executeSelect(sql: string, args?: Record<string, unknown> | unknown[]): LibSQLResult {
    const tableName = this.extractTableName(sql, "FROM");
    const table = this.tables.get(tableName);

    if (!table) {
      return { rows: [], columns: [], rows_affected: 0, last_insert_rowid: null };
    }

    let rows = [...table.values()];

    if (args && !Array.isArray(args)) {
      const whereArgs = args as Record<string, unknown>;
      for (const [key, value] of Object.entries(whereArgs)) {
        rows = rows.filter(row => row[key] === value);
      }
    }

    if (sql.toUpperCase().includes("ORDER BY")) {
      const orderMatch = sql.match(/ORDER\s+BY\s+(\w+)(?:\s+(ASC|DESC))?/i);
      if (orderMatch) {
        const field = orderMatch[1];
        const dir = (orderMatch[2] ?? "ASC").toUpperCase();
        rows.sort((a, b) => {
          const va = a[field];
          const vb = b[field];
          if (va === vb) return 0;
          if (va == null) return 1;
          if (vb == null) return -1;
          const cmp = String(va).localeCompare(String(vb));
          return dir === "DESC" ? -cmp : cmp;
        });
      }
    }

    if (sql.toUpperCase().includes("LIMIT")) {
      const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
      if (limitMatch) {
        rows = rows.slice(0, parseInt(limitMatch[1], 10));
      }
    }

    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    return { rows, columns, rows_affected: 0, last_insert_rowid: null };
  }

  private executeInsert(sql: string, args?: Record<string, unknown> | unknown[]): LibSQLResult {
    const tableName = this.extractTableName(sql, "INTO");
    if (!this.tables.has(tableName)) {
      this.tables.set(tableName, new Map());
    }
    const table = this.tables.get(tableName)!;

    const counter = (this.autoIncrementCounters.get(tableName) ?? 0) + 1;
    this.autoIncrementCounters.set(tableName, counter);

    let row: Record<string, unknown>;

    if (args && !Array.isArray(args)) {
      row = { ...(args as Record<string, unknown>) };
    } else {
      row = {};
    }

    const pkField = this.inferPrimaryKey(tableName);
    if (!row[pkField]) {
      row[pkField] = `${tableName.slice(0, -1)}_${createEntityId("row")}`;
    }

    table.set(String(row[pkField]), row);
    return { rows: [row], columns: Object.keys(row), rows_affected: 1, last_insert_rowid: counter };
  }

  private executeUpdate(sql: string, args?: Record<string, unknown> | unknown[]): LibSQLResult {
    const tableName = this.extractTableName(sql, "UPDATE");
    const table = this.tables.get(tableName);
    if (!table) return { rows: [], columns: [], rows_affected: 0, last_insert_rowid: null };

    let rowsAffected = 0;
    if (args && !Array.isArray(args)) {
      const updateArgs = args as Record<string, unknown>;
      for (const [id, row] of table.entries()) {
        const pkField = this.inferPrimaryKey(tableName);
        if (updateArgs[pkField] && row[pkField] === updateArgs[pkField]) {
          Object.assign(row, updateArgs);
          table.set(id, row);
          rowsAffected++;
        }
      }
    }

    return { rows: [], columns: [], rows_affected: rowsAffected, last_insert_rowid: null };
  }

  private executeDelete(sql: string, args?: Record<string, unknown> | unknown[]): LibSQLResult {
    const tableName = this.extractTableName(sql, "FROM");
    const table = this.tables.get(tableName);
    if (!table) return { rows: [], columns: [], rows_affected: 0, last_insert_rowid: null };

    let rowsAffected = 0;
    if (args && !Array.isArray(args)) {
      const deleteArgs = args as Record<string, unknown>;
      const pkField = this.inferPrimaryKey(tableName);
      if (deleteArgs[pkField]) {
        const deleted = table.delete(String(deleteArgs[pkField]));
        rowsAffected = deleted ? 1 : 0;
      }
    }

    return { rows: [], columns: [], rows_affected: rowsAffected, last_insert_rowid: null };
  }

  private executeCreateTable(sql: string): void {
    const tableName = this.extractTableName(sql, "TABLE");
    if (!this.tables.has(tableName)) {
      this.tables.set(tableName, new Map());
    }
  }

  private extractTableName(sql: string, keyword: string): string {
    const pattern = new RegExp(`${keyword}\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?(\\w+)`, "i");
    const match = sql.match(pattern);
    return match?.[1]?.replace(/[`;]/g, "") ?? "unknown";
  }

  private inferPrimaryKey(tableName: string): string {
    const singular = tableName.endsWith("s") ? tableName.slice(0, -1) : tableName;
    return `${singular}_id`;
  }
}

export function createPersistenceAdapter(config: LibSQLConnectionConfig): PersistenceAdapter {
  if (config.url === "in-memory" || config.url === "" || config.url.startsWith("memory:")) {
    return new InMemoryPersistenceAdapter();
  }

  return new InMemoryPersistenceAdapter();
}

export function createDefaultLibSQLConfig(): LibSQLConnectionConfig {
  return {
    url: process.env.DATABASE_URL ?? "in-memory",
    authToken: process.env.DATABASE_AUTH_TOKEN ?? "",
    syncUrl: process.env.DATABASE_SYNC_URL ?? "",
    syncIntervalMs: parseInt(process.env.DATABASE_SYNC_INTERVAL_MS ?? "5000", 10),
    localPath: process.env.DATABASE_LOCAL_PATH ?? ".apex/remote-control-plane.sqlite",
    poolSize: parseInt(process.env.DATABASE_CONNECTION_POOL_SIZE ?? "5", 10),
    connectTimeoutMs: parseInt(process.env.DATABASE_CONNECT_TIMEOUT_MS ?? "10000", 10),
    readOnly: (process.env.DATABASE_READ_ONLY ?? "false") === "true"
  };
}
