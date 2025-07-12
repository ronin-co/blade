import logIn from '@/src/commands/login';
import { readConfig, saveConfig } from '@/src/utils/config';
import { select } from '@inquirer/prompts';
import type { Ora } from 'ora';

/**
 * Fetches all available spaces for the authenticated user session.
 *
 * @param sessionToken - Authentication token used to authorize the API request.
 *
 * @returns Promise resolving to an array of space objects containing id, handle and name.
 *
 * @throws {Error} If the API request fails or returns an error response.
 *
 * @example
 * ```typescript
 * const spaces = await getSpaces('user-session-token');
 * // Returns: [{ id: '123', handle: 'my-space', name: 'My Space' }, ...]
 * ```
 */
export const getSpaces = async (
  sessionToken: string,
): Promise<Array<{ id: string; handle: string; name: string }>> => {
  try {
    const response = await fetch('https://ronin.co/api', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `token=${sessionToken}`,
      },
      body: JSON.stringify({
        queries: [
          {
            get: {
              members: {
                using: ['space', 'account'],
                with: {
                  team: null,
                },
              },
            },
          },
        ],
      }),
    });

    // We only reach this point if the session is invalid.
    if (!response.ok && response.status === 400) {
      const sessionToken = await logIn();

      if (!sessionToken) {
        throw new Error('Failed to log in.');
      }

      return getSpaces(sessionToken);
    }

    if (!response.ok) {
      throw new Error(`API request failed with status: ${response.status}`);
    }

    const data = (await response.json()) as {
      results: Array<Array<{ space: { id: string; handle: string; name: string } }>>;
      error?: string;
    };

    if (data.error) {
      throw new Error(data.error);
    }

    return data.results[0].map((member) => member.space);
  } catch (error) {
    throw new Error(`Failed to fetch available spaces: ${(error as Error).message}`);
  }
};

/**
 * Helper to get or interactively select a space ID.
 *
 * @param sessionToken - Authentication token used to authorize the API request.
 * @param spinner - Optional ora spinner instance to stop and start.
 *
 * @returns Promise resolving to the selected space ID.
 */
export const getOrSelectSpaceId = async (
  sessionToken?: string,
  spinner?: Ora,
): Promise<string> => {
  let { space } = readConfig();

  if (!space && sessionToken) {
    const spaces = await getSpaces(sessionToken);

    if (spaces?.length === 0) {
      throw new Error(
        "You don't have access to any space or your CLI session is invalid.\n\n" +
          'Please login again (by running `npx ronin login`) or ' +
          'create a new space on the dashboard (`https://ronin.co/new`) and try again.',
      );
    }

    if (spaces.length === 1) {
      space = spaces[0].id;
    } else {
      spinner?.stop();

      space = await select({
        message: 'Which space do you want to apply models to?',
        choices: spaces.map((space) => ({
          name: space.handle,
          value: space.id,
          description: space.name,
        })),
      });
    }

    saveConfig({ space });
  }

  if (!space) {
    throw new Error('Space ID is not specified.');
  }

  return space;
};
