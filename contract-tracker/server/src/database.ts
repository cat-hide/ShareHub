import initSqlJs, { SqlJsStatic, SqlJsDatabase } from 'sql.js';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

const DB_PATH = path.join(__dirname, '..', 'data.db');

// ============================================================
// better-sqlite3 兼容封装
// 提供 .prepare(sql).run(...) / .get(...) / .all(...) 接口
// ============================================================

interface RunResult {
  lastInsertRowid: number;
  changes: number;
}

/**
 * 数据库写入互斥锁 + 防抖保存
 *
 * 使用 Promise 队列确保同一时刻只有一个保存操作在进行，
 * 结合防抖机制（300ms）减少高频写入时的磁盘 I/O。
 */
class SaveScheduler {
  private pending = false;
  private timer: NodeJS.Timeout | null = null;
  private saving: Promise<void> = Promise.resolve();
  private doSave: () => void;

  constructor(doSave: () => void) {
    this.doSave = doSave;
  }

  /** 请求保存 — 防抖延迟后执行，自动排队 */
  request(): void {
    this.pending = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush();
    }, 300);
  }

  /** 立即持久化（用于关键操作后强制落盘） */
  flushNow(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.flush();
  }

  private flush(): void {
    if (!this.pending) return;
    this.pending = false;

    // 链式排队：上一次保存完成后再执行下一次
    this.saving = this.saving.then(() => {
      try {
        this.doSave();
      } catch (err) {
        console.error('[DB] Save failed:', err);
      }
    });
  }

  /** 等待所有挂起的保存完成（优雅关闭用） */
  async drain(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.flush();
    await this.saving;
  }
}

class Statement {
  private db: SqlJsDatabase;
  private sql: string;
  private stmt: ReturnType<SqlJsDatabase['prepare']> | null = null;
  private dbWrapper: DatabaseWrapper;

  constructor(db: SqlJsDatabase, sql: string, dbWrapper: DatabaseWrapper) {
    this.db = db;
    this.sql = sql;
    this.dbWrapper = dbWrapper;
  }

  private ensureStmt(): ReturnType<SqlJsDatabase['prepare']> {
    if (!this.stmt) {
      this.stmt = this.db.prepare(this.sql);
    }
    return this.stmt;
  }

  run(...params: unknown[]): RunResult {
    this.ensureStmt().bind(params);
    this.ensureStmt().step();
    this.ensureStmt().free();
    this.stmt = null;

    // 防抖保存（不再每次 run 都立即写磁盘）
    this.dbWrapper.requestSave();

    // sql.js doesn't expose lastInsertRowid directly; query it
    const rowIdResult = this.db.exec('SELECT last_insert_rowid() as id');
    const changesResult = this.db.exec('SELECT changes() as changes');
    const lastInsertRowid = rowIdResult.length > 0 ? (rowIdResult[0].values[0][0] as number) : 0;
    const changes = changesResult.length > 0 ? (changesResult[0].values[0][0] as number) : 0;
    return { lastInsertRowid, changes };
  }

  get(...params: unknown[]): Record<string, unknown> | undefined {
    this.ensureStmt().bind(params);
    if (this.ensureStmt().step()) {
      const result = this.ensureStmt().getAsObject();
      this.ensureStmt().free();
      this.stmt = null;
      return result;
    }
    this.ensureStmt().free();
    this.stmt = null;
    return undefined;
  }

  all(...params: unknown[]): Record<string, unknown>[] {
    this.ensureStmt().bind(params);
    const results: Record<string, unknown>[] = [];
    while (this.ensureStmt().step()) {
      results.push(this.ensureStmt().getAsObject());
    }
    this.ensureStmt().free();
    this.stmt = null;
    return results;
  }
}

class DatabaseWrapper {
  private db: SqlJsDatabase;
  private scheduler: SaveScheduler;

  constructor(db: SqlJsDatabase) {
    this.db = db;
    this.scheduler = new SaveScheduler(() => {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(DB_PATH, buffer);
    });
  }

  prepare(sql: string): Statement {
    return new Statement(this.db, sql, this);
  }

  exec(sql: string): void {
    this.db.exec(sql);
  }

  /** 请求防抖保存（每次写操作后自动调用） */
  requestSave(): void {
    this.scheduler.request();
  }

  /** 立即强制保存到磁盘 */
  saveSync(): void {
    this.scheduler.flushNow();
  }

  /** 等待所有挂起保存完成（优雅关闭） */
  async shutdown(): Promise<void> {
    await this.scheduler.drain();
  }
}

// ============================================================
// 全局数据库实例
// ============================================================

let db: DatabaseWrapper;

export function getDatabase(): DatabaseWrapper {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

export async function initializeDatabase(): Promise<void> {
  const SQL: SqlJsStatic = await initSqlJs();

  let sqlDb: SqlJsDatabase;

  // Try to load existing database file
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    sqlDb = new SQL.Database(fileBuffer);
  } else {
    sqlDb = new SQL.Database();
  }

  db = new DatabaseWrapper(sqlDb);

  // Enable WAL mode and foreign keys
  db.exec('PRAGMA journal_mode=WAL;');
  db.exec('PRAGMA foreign_keys=ON;');

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      username    TEXT    NOT NULL UNIQUE,
      password    TEXT    NOT NULL,
      display_name TEXT   NOT NULL,
      role        TEXT    NOT NULL DEFAULT 'sales' CHECK(role IN ('sales', 'admin')),
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS contracts (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_no    TEXT    NOT NULL UNIQUE,
      project_no     TEXT,
      project_name   TEXT,
      contract_name  TEXT    NOT NULL,
      party          TEXT    NOT NULL,
      amount         REAL    NOT NULL,
      signed_date    TEXT    NOT NULL,
      status         TEXT    NOT NULL DEFAULT '进行中' CHECK(status IN ('进行中', '已完成', '已终止')),
      salesperson_id   INTEGER,
      salesperson_name TEXT,
      attachment_name TEXT,
      attachment_path TEXT,
      attachment_size INTEGER,
      created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (salesperson_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS contract_materials (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_id    INTEGER NOT NULL,
      material_code  TEXT,
      material_name  TEXT    NOT NULL,
      specification  TEXT,
      unit           TEXT,
      quantity       REAL    NOT NULL DEFAULT 0,
      unit_price     REAL    NOT NULL DEFAULT 0,
      subtotal       REAL    NOT NULL DEFAULT 0,
      tax_rate       REAL    NOT NULL DEFAULT 0,
      tax_amount     REAL    NOT NULL DEFAULT 0,
      total_with_tax REAL    NOT NULL DEFAULT 0,
      remark         TEXT,
      created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE
    );

  `);

  // Migration: add project_name column to existing databases
  try { db.exec('ALTER TABLE contracts ADD COLUMN project_name TEXT'); } catch (_e) { /* column exists */ }
  try { db.exec('ALTER TABLE contracts ADD COLUMN salesperson_name TEXT'); } catch (_e) { /* column exists */ }

  // Migration: add material columns to shipments table
  try { db.exec('ALTER TABLE shipments ADD COLUMN material_id INTEGER'); } catch (_e) { /* column exists */ }
  try { db.exec('ALTER TABLE shipments ADD COLUMN shipped_quantity REAL NOT NULL DEFAULT 0'); } catch (_e) { /* column exists */ }
  try { db.exec('ALTER TABLE shipments ADD COLUMN material_code TEXT'); } catch (_e) { /* column exists */ }
  try { db.exec('ALTER TABLE shipments ADD COLUMN material_name TEXT'); } catch (_e) { /* column exists */ }
  try { db.exec('ALTER TABLE shipments ADD COLUMN specification TEXT'); } catch (_e) { /* column exists */ }
  try { db.exec('ALTER TABLE shipments ADD COLUMN unit TEXT'); } catch (_e) { /* column exists */ }

  // Migration: add access_token column to attachment tables (for token-based secure preview)
  try { db.exec('ALTER TABLE contract_attachments ADD COLUMN access_token TEXT'); } catch (_e) { /* column exists */ }
  try { db.exec('ALTER TABLE invoice_attachments ADD COLUMN access_token TEXT'); } catch (_e) { /* column exists */ }
  try { db.exec('ALTER TABLE payment_attachments ADD COLUMN access_token TEXT'); } catch (_e) { /* column exists */ }
  try { db.exec('ALTER TABLE shipment_attachments ADD COLUMN access_token TEXT'); } catch (_e) { /* column exists */ }

  db.exec(`
    CREATE TABLE IF NOT EXISTS invoices (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_id   INTEGER NOT NULL,
      invoice_no    TEXT    NOT NULL,
      invoice_date  TEXT    NOT NULL,
      amount        REAL    NOT NULL,
      invoice_type  TEXT    NOT NULL DEFAULT '增值税专用发票',
      inv_attachment_name TEXT,
      inv_attachment_path TEXT,
      inv_attachment_size INTEGER,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS payments (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_id  INTEGER NOT NULL,
      payment_date TEXT    NOT NULL,
      amount       REAL    NOT NULL,
      status       TEXT    NOT NULL DEFAULT '未收款' CHECK(status IN ('已收款', '未收款')),
      pay_attachment_name TEXT,
      pay_attachment_path TEXT,
      pay_attachment_size INTEGER,
      created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at   TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS shipments (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_id    INTEGER NOT NULL,
      shipment_date  TEXT    NOT NULL,
      description    TEXT,
      material_id    INTEGER,
      shipped_quantity REAL NOT NULL DEFAULT 0,
      material_code  TEXT,
      material_name  TEXT,
      specification  TEXT,
      unit           TEXT,
      ship_attachment_name TEXT,
      ship_attachment_path TEXT,
      ship_attachment_size INTEGER,
      created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS contract_attachments (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_id   INTEGER NOT NULL,
      original_name TEXT    NOT NULL,
      storage_name  TEXT    NOT NULL,
      file_size     INTEGER NOT NULL,
      access_token  TEXT,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS invoice_attachments (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id    INTEGER NOT NULL,
      original_name TEXT    NOT NULL,
      storage_name  TEXT    NOT NULL,
      file_size     INTEGER NOT NULL,
      access_token  TEXT,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS payment_attachments (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_id    INTEGER NOT NULL,
      original_name TEXT    NOT NULL,
      storage_name  TEXT    NOT NULL,
      file_size     INTEGER NOT NULL,
      access_token  TEXT,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS shipment_attachments (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      shipment_id   INTEGER NOT NULL,
      original_name TEXT    NOT NULL,
      storage_name  TEXT    NOT NULL,
      file_size     INTEGER NOT NULL,
      access_token  TEXT,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (shipment_id) REFERENCES shipments(id) ON DELETE CASCADE
    );
  `);

  // Migrate existing attachment data from contracts table to contract_attachments
  const attachmentCount = db.prepare('SELECT COUNT(*) as count FROM contract_attachments').get() as { count: number };
  if (attachmentCount.count === 0) {
    db.exec(`
      INSERT INTO contract_attachments (contract_id, original_name, storage_name, file_size)
      SELECT id, attachment_name, attachment_path, attachment_size
      FROM contracts
      WHERE attachment_name IS NOT NULL
    `);
  }

  // Generate access tokens for legacy attachments that don't have one
  db.exec(`UPDATE contract_attachments SET access_token = hex(randomblob(16)) WHERE access_token IS NULL`);
  db.exec(`UPDATE invoice_attachments SET access_token = hex(randomblob(16)) WHERE access_token IS NULL`);
  db.exec(`UPDATE payment_attachments SET access_token = hex(randomblob(16)) WHERE access_token IS NULL`);
  db.exec(`UPDATE shipment_attachments SET access_token = hex(randomblob(16)) WHERE access_token IS NULL`);

  // Migrate existing invoice attachment data to invoice_attachments
  const invAttCount = db.prepare('SELECT COUNT(*) as count FROM invoice_attachments').get() as { count: number };
  if (invAttCount.count === 0) {
    db.exec(`
      INSERT INTO invoice_attachments (invoice_id, original_name, storage_name, file_size)
      SELECT id, inv_attachment_name, inv_attachment_path, inv_attachment_size
      FROM invoices WHERE inv_attachment_name IS NOT NULL
    `);
    db.exec(`UPDATE invoice_attachments SET access_token = hex(randomblob(16)) WHERE access_token IS NULL`);
  }

  // Migrate existing payment attachment data to payment_attachments
  const payAttCount = db.prepare('SELECT COUNT(*) as count FROM payment_attachments').get() as { count: number };
  if (payAttCount.count === 0) {
    db.exec(`
      INSERT INTO payment_attachments (payment_id, original_name, storage_name, file_size)
      SELECT id, pay_attachment_name, pay_attachment_path, pay_attachment_size
      FROM payments WHERE pay_attachment_name IS NOT NULL
    `);
    db.exec(`UPDATE payment_attachments SET access_token = hex(randomblob(16)) WHERE access_token IS NULL`);
  }

  // Migrate existing shipment attachment data to shipment_attachments
  const shipAttCount = db.prepare('SELECT COUNT(*) as count FROM shipment_attachments').get() as { count: number };
  if (shipAttCount.count === 0) {
    db.exec(`
      INSERT INTO shipment_attachments (shipment_id, original_name, storage_name, file_size)
      SELECT id, ship_attachment_name, ship_attachment_path, ship_attachment_size
      FROM shipments WHERE ship_attachment_name IS NOT NULL
    `);
    db.exec(`UPDATE shipment_attachments SET access_token = hex(randomblob(16)) WHERE access_token IS NULL`);
  }

  // Migrate existing payment status values to new two-state model
  db.exec(`UPDATE payments SET status = '已收款' WHERE status = '已回款'`);
  db.exec(`UPDATE payments SET status = '未收款' WHERE status NOT IN ('已收款', '未收款')`);

  // Migrate payments table schema to add CHECK constraint if needed
  const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='payments'").get() as { sql: string } | undefined;
  if (tableInfo && !tableInfo.sql.includes("CHECK(status IN ('已收款', '未收款'))")) {
    db.exec('ALTER TABLE payments RENAME TO payments_old');
    db.exec(`
      CREATE TABLE payments (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        contract_id  INTEGER NOT NULL,
        payment_date TEXT    NOT NULL,
        amount       REAL    NOT NULL,
        status       TEXT    NOT NULL DEFAULT '未收款' CHECK(status IN ('已收款', '未收款')),
        pay_attachment_name TEXT,
        pay_attachment_path TEXT,
        pay_attachment_size INTEGER,
        created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at   TEXT    NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE
      )
    `);
    db.exec('INSERT INTO payments SELECT * FROM payments_old');
    db.exec('DROP TABLE payments_old');
  }

  // Seed data
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (userCount.count === 0) {
    const adminHash = bcrypt.hashSync('admin123', 10);
    const salesHash = bcrypt.hashSync('123456', 10);

    db.prepare('INSERT INTO users (username, password, display_name, role) VALUES (?, ?, ?, ?)').run('admin', adminHash, '管理员', 'admin');
    db.prepare('INSERT INTO users (username, password, display_name, role) VALUES (?, ?, ?, ?)').run('sales1', salesHash, '张三', 'sales');
    db.prepare('INSERT INTO users (username, password, display_name, role) VALUES (?, ?, ?, ?)').run('sales2', salesHash, '李四', 'sales');

    console.log('Database seeded successfully');
  }

  // Save database to file (force immediate save on init)
  db.saveSync();
  console.log('Database initialized successfully');
}
