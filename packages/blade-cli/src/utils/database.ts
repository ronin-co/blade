import fs from 'node:fs';
import { ROOT_MODEL, Transaction } from '@ronin/compiler';
import { Engine } from '@ronin/engine';
import { BunDriver } from '@ronin/engine/drivers/bun';
import { MemoryResolver } from '@ronin/engine/resolvers/memory';
import type { Database } from '@ronin/engine/resources';

/**
 * Initializes a new database instance.
 *
 * @param fsPath - The file system path at which the database should be stored.
 *
 * @returns A new database instance.
 */
export const initializeDatabase = async (
  fsPath = '.ronin/db.sqlite',
): Promise<Database> => {
  const engine = new Engine({
    driver: (engine): BunDriver => new BunDriver({ engine }),
    resolvers: [(engine) => new MemoryResolver({ engine })],
  });

  const transaction = new Transaction([
    {
      create: { model: ROOT_MODEL },
    },
  ]);

  const db = await engine.createDatabase({ id: 'local' });

  if (fs.existsSync(fsPath)) {
    const file = fs.readFileSync(fsPath);
    const buffer = new Uint8Array(file);
    await db.setContents(buffer);
  }

  try {
    await db.query(transaction.statements.map((statement) => statement.statement));
  } catch (_error) {
    // RONIN_SCHEMA already exists
  }

  return db;
};
