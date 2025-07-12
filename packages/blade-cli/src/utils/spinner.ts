import ora, { type Ora } from 'ora';

/** Current status of the migration creation process */
export type Status = 'readingConfig' | 'readingModels' | 'comparing' | 'syncing';

export const spinner: Ora = ora().start();
