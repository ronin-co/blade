import { parseArgs } from 'node:util';

import path from 'node:path';
import apply from '@/src/commands/apply';
import diff from '@/src/commands/diff';
import initializeProject from '@/src/commands/init';
import logIn from '@/src/commands/login';
import pull from '@/src/commands/pull';
import generateTypes, { TYPES_FLAGS } from '@/src/commands/types';
import { printHelp, printVersion } from '@/src/utils/info';
import { MIGRATION_FLAGS, type MigrationFlags } from '@/src/utils/migration';
import { BASE_FLAGS, type BaseFlags } from '@/src/utils/misc';
import { getSession } from '@/src/utils/session';
import { spinner } from '@/src/utils/spinner';

/**
 * Runs the RONIN command-line interface (CLI) with the provided configuration options.
 * The `blade-cli` package intentionally doesn't do this itself, since the CLI is instead
 * automatically installed and exposed via the shorter `ronin` package name.
 *
 * @param config - Options for customizing the behavior of the CLI.
 *
 * @returns Nothing.
 */
export const run = async (config: { version: string }): Promise<void> => {
  let flags: BaseFlags;
  let positionals: Array<string>;

  try {
    ({ values: flags, positionals } = parseArgs({
      args: process.argv,
      options: { ...BASE_FLAGS, ...MIGRATION_FLAGS, ...TYPES_FLAGS },
      strict: true,
      allowPositionals: true,
    }));
  } catch (err) {
    if (err instanceof Error) {
      spinner.fail(err.message);
    }

    process.exit(1);
  }

  // Exit gracefully on SIGINT
  process.on('SIGINT', () => {
    process.exit(0);
  });

  // Exit gracefully on SIGTERM
  process.on('SIGTERM', () => {
    process.exit(0);
  });

  // Flags for printing useful information about the CLI.
  if (flags.help) return printHelp();
  if (flags.version) return printVersion(config.version);

  // This ensures that people can accidentally type uppercase letters and still get the
  // command they are looking for.
  const normalizedPositionals = positionals.map((positional) => positional.toLowerCase());

  // If this environment variable is provided, the CLI will authenticate as an app for a
  // particular space instead of authenticating as an account. This is especially useful
  // in CI, which must be independent of individual people.
  const appToken = process.env.RONIN_TOKEN;

  // If there is no active session, automatically start one and then continue with the
  // execution of the requested sub command, if there is one. If the `login` sub command
  // is invoked, we don't need to auto-login, since the command itself will handle it.
  const session = await getSession();

  if (!(process.stdout.isTTY || session || appToken)) {
    let message = 'If RONIN CLI is invoked from a non-interactive shell, ';
    message +=
      'a `RONIN_TOKEN` environment variable containing an app token must be provided.';

    spinner.fail(message);
    process.exit(1);
  }

  if (!(session || normalizedPositionals.includes('login'))) await logIn(appToken, false);

  // `login` sub command
  if (normalizedPositionals.includes('login')) {
    await logIn(appToken);
    return;
  }

  // `init` sub command
  if (normalizedPositionals.includes('init'))
    return initializeProject(positionals, {
      appToken: appToken,
      sessionToken: session?.token,
    });

  // `diff` sub command
  if (normalizedPositionals.includes('diff')) {
    return diff(appToken, session?.token, flags, positionals);
  }

  // `apply` sub command
  if (normalizedPositionals.includes('apply')) {
    const migrationFilePath = positionals?.[positionals.indexOf('apply') + 1]
      ? path.join(process.cwd(), positionals[positionals.indexOf('apply') + 1])
      : undefined;

    return apply(appToken, session?.token, flags, migrationFilePath);
  }

  // `types` sub command.
  if (normalizedPositionals.includes('types'))
    return generateTypes(appToken, session?.token, flags);

  // `pull` sub command
  if (normalizedPositionals.includes('pull')) {
    return pull(appToken, session?.token, (flags as MigrationFlags).local);
  }

  // If no matching flags or commands were found, render the help, since we don't want to
  // use the main `ronin` command for anything yet.
  return printHelp();
};

export default run;
