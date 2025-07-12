import http from 'node:http';
import getPort from 'get-port';
import open from 'open';
import ora from 'ora';

import { storeSession, storeTokenForBun, storeTokenForNPM } from '@/src/utils/session';

const logIn = async (appToken?: string, exit = true): Promise<string | undefined> => {
  const spinner = ora('Logging in').start();

  // If an app token is provided, we don't want to store a session for the CLI, since all
  // commands will instead use the provided app token directly. We do want to store the
  // token for package managers, however, because those require config files to make the
  // package scope work.
  if (appToken) {
    // Initialize config files for relevant package managers.
    await Promise.all([storeTokenForNPM(appToken), storeTokenForBun(appToken)]);

    spinner.succeed('Logged in successfully!');

    if (exit) process.exit(0);
    return;
  }

  // Authenticates a particular RONIN account.
  let sessionToken: string | undefined;

  const port = await getPort();
  const server = http.createServer().listen(port);

  const baseURL = new URL('https://ronin.co/actions/auth/cli');

  const currentHost = `http://localhost:${port}`;
  const initURL = new URL(baseURL);
  initURL.searchParams.set('from', currentHost);

  spinner.text = `Please log in using the following URL:\n${initURL.href}`;
  spinner.suffixText = '\n';

  try {
    [sessionToken] = await Promise.all([
      new Promise<string>((resolve, reject) => {
        server.once('request', (req, res) => {
          res.setHeader('connection', 'close');

          const requestURL = new URL(req.url || '', currentHost);
          const requestToken = requestURL.searchParams.get('token');

          if (!requestToken) return reject(new Error('Missing token'));
          resolve(requestToken);

          const headers = { Location: baseURL.href };
          res.writeHead(307, headers).end();
        });

        server.once('error', reject);
      }),
      open(initURL.href),
    ]);
  } finally {
    server.close();
  }

  // Initialize config files for the CLI and all relevant package managers.
  await Promise.all([
    storeSession(sessionToken),
    storeTokenForNPM(sessionToken),
    storeTokenForBun(sessionToken),
  ]);

  spinner.suffixText = '';
  spinner.succeed('Logged in successfully!');

  if (exit) process.exit(0);

  return sessionToken;
};

export default logIn;
