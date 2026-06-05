import { webcrypto } from 'node:crypto';
import mongoose from 'mongoose';

import { connectDatabase } from '../../../config/database';
import { importPuzzlesFromCsv } from '../pattern-forge.service';

if (!globalThis.crypto) {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    configurable: true,
  });
}

const getArgValue = (flag: string): string | undefined => {
  const exact = process.argv.find((arg) => arg.startsWith(`${flag}=`));

  if (exact) {
    return exact.split('=').slice(1).join('=');
  }

  const index = process.argv.indexOf(flag);

  if (index >= 0) {
    return process.argv[index + 1];
  }

  return undefined;
};

const main = async (): Promise<void> => {
  const filePath = getArgValue('--file') ?? process.env.PUZZLE_IMPORT_CSV_PATH;
  const limitValue = getArgValue('--limit');

  if (!filePath) {
    throw new Error('Missing required --file argument.');
  }

  const limit = limitValue ? Number(limitValue) : undefined;

  await connectDatabase();
  const result = await importPuzzlesFromCsv({
    filePath,
    limit: Number.isFinite(limit) ? limit : undefined,
  });

  console.log('Puzzle import completed.', result);
};

void main()
  .catch((error) => {
    console.error('Puzzle import failed.', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
