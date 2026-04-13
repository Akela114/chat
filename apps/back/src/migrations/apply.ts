import { Client } from 'pg'
import fs from 'fs'
import path from 'path'
import { promisify } from 'util'

const getLastMigrationVersion = async (client: any) => {
  await client.query('CREATE TABLE IF NOT EXISTS migrations (id SERIAL PRIMARY KEY, version INTEGER NOT NULL)');
  try {
    const result = await client.query('SELECT MAX(version) FROM migrations');
    return result.rows[0].max ?? -1;
  } catch (error) {
    return -1;
  }
}

async function migrate() {
  const client = new Client({
    host: "postgres",
    port: 5432,
    database: "postgres",
    user: "postgres",
    password: "postgres",
  });
  await client.connect();
  
  const lastMigrationVersion = await getLastMigrationVersion(client);
  
  const migrationsDir = path.join((import.meta as any).dirname, './');
  const files = await promisify(fs.readdir)(migrationsDir);
  const filteredFiles = files.filter((file: any) => {
    const splittedFileName = file.split('.');
    if (splittedFileName.at(-1) !== 'sql') return false;
    return parseInt(splittedFileName[0]) > lastMigrationVersion;
  }).sort((fileA: any, fileB: any) => {
    const fileAVersion = parseInt(fileA.split('.')[0]);
    const fileBVersion = parseInt(fileB.split('.')[0]);
    return fileAVersion - fileBVersion;
  })
  
  for (const file of filteredFiles) {
    console.log(`Applying migration: ${file}`);
    const sql = await promisify(fs.readFile)(path.join(migrationsDir, file), 'utf8');
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO migrations (version) VALUES ($1)', [parseInt(file.split('.')[0])]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
    console.log(`Migration applied: ${file}`);
  }
  await client.end();
}

try {
  console.log("Starting migrations...");
  await migrate();
  console.log("Migrations applied.");
} catch (error) {
  console.error("Error applying migrations:", error);
}