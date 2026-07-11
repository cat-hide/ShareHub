import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import os from 'os';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

import { initializeDatabase, getDatabase } from './database';
import { createApp } from './app';
import { PORT, EXCEL_IMPORT_PATH } from './config';

async function importExcel() {
  const db = getDatabase();
  if (!EXCEL_IMPORT_PATH) { console.log('EXCEL_IMPORT_PATH not configured, skipping Excel import'); return; }
  if (!fs.existsSync(EXCEL_IMPORT_PATH)) { console.log(`Excel file not found: ${EXCEL_IMPORT_PATH}, skipping`); return; }

  // Check if already imported
  const existing = db.prepare('SELECT id FROM contracts WHERE contract_no = ?').get('20220613') as any;
  if (existing) { console.log('Excel data already imported, skipping'); return; }

  const ExcelJS = require('exceljs');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(EXCEL_IMPORT_PATH);
  const ws = wb.worksheets[0];
  let imported = 0;
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const dc = row.getCell(2).value;
    const contractNo = String(row.getCell(3).value ?? '').trim();
    if (!contractNo) continue;
    const signedDate = dc instanceof Date ? dc.toISOString().slice(0, 10) : typeof dc === 'number' ? new Date(new Date(1899, 11, 30).getTime() + dc * 86400000).toISOString().slice(0, 10) : '';
    const projectNo = String(row.getCell(4).value ?? '').trim() || null;
    const projectName = String(row.getCell(5).value ?? '').trim() || null;
    const party = String(row.getCell(6).value ?? '').trim();
    const contractName = String(row.getCell(7).value ?? '').trim();
    const spName = String(row.getCell(8).value ?? '').trim() || null;
    const av = row.getCell(9).value;
    const amount = typeof av === 'number' ? av : parseFloat(String(av ?? '').replace(/,/g, ''));
    if (!signedDate || !party || !contractName || isNaN(amount) || amount <= 0) continue;

    // Skip duplicate contract_no
    if (db.prepare('SELECT id FROM contracts WHERE contract_no = ?').get(contractNo)) continue;

    let sid: number|null = null;
    if (spName) {
      const u = db.prepare('SELECT id FROM users WHERE display_name = ?').get(spName) as any;
      if (u) sid = u.id;
    }
    db.prepare('INSERT INTO contracts (contract_no,project_no,project_name,contract_name,party,amount,signed_date,status,salesperson_id,salesperson_name) VALUES (?,?,?,?,?,?,?,\'进行中\',?,?)')
      .run(contractNo, projectNo, projectName, contractName, party, amount, signedDate, sid, spName);
    imported++;
  }
  db.saveSync();
  console.log(`Excel imported: ${imported} contracts`);
}

async function main(): Promise<void> {
  await initializeDatabase();
  try { await importExcel(); } catch(e) { console.error('Import error:', (e as Error).message); }

  const db = getDatabase();
  const cc = (db.prepare('SELECT COUNT(*) as c FROM contracts').get() as any).c;
  console.log(`Total contracts: ${cc}`);

  const app = createApp();
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}`);
    // Print LAN address for local network access
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      const iface = nets[name];
      if (!iface) continue;
      for (const info of iface) {
        if (info.family === 'IPv4' && !info.internal) {
          console.log(`  LAN access: http://${info.address}:${PORT}`);
        }
      }
    }
  });

  // Graceful shutdown — wait for pending DB saves before exit
  const gracefulShutdown = async (signal: string) => {
    console.log(`\n[${signal}] Shutting down gracefully...`);
    server.close();
    await db.shutdown();
    console.log('Database saved. Goodbye.');
    process.exit(0);
  };

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
