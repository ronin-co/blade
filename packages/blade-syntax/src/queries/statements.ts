import type { Statement } from 'blade-compiler';

const MULTILINE_SQL_COMMENTS = /\/\*[\s\S]*?\*\//g;
const SINGLELINE_SQL_COMMENTS = /--[^\n]*\n/g;

/**
 * Used to track whether SQL queries are run in batches.
 */
let IN_SQL_BATCH = false;

/**
 * Provides a template literal function that, when called, constructs an SQL statement
 * and a separate list of parameters for the statement.
 *
 * @param options - An object containing configuration for the composed structure.
 *
 * @returns A function for constructing SQL statements.
 */
export const getSyntaxProxySQL = (options: {
  callback: (statement: Statement) => Promise<any> | any;
}) => {
  return (strings: TemplateStringsArray, ...values: Array<unknown>): Promise<any> => {
    let text = '';
    const params: Array<unknown> = [];

    strings.forEach((string, i) => {
      // Remove comments but preserve the newline
      const processedString = string
        .replace(MULTILINE_SQL_COMMENTS, '')
        .replace(SINGLELINE_SQL_COMMENTS, '\n');

      text += processedString;

      if (i < values.length) {
        text += `$${i + 1}`;
        params.push(values[i]);
      }
    });

    const statement: Statement = {
      // Collapse whitespace and newlines into single spaces, then trim leading or
      // trailing spaces.
      statement: text.replace(/\s+/g, ' ').trim(),
      params,
    };

    // If the function is being executed within a batch, return the statement instead of
    // executing it using the callback.
    if (IN_SQL_BATCH) return statement as unknown as Promise<any>;

    return options.callback(statement);
  };
};

/**
 * Obtains a list of SQL statements from a function by wrapping the SQL functions into a
 * context that prevents the SQL statements from being executed.
 *
 * @param operations - A function that contains multiple SQL functions.
 *
 * @returns A list of SQL statements.
 */
export const getBatchProxySQL = (
  operations: () => Array<Statement> | Array<Promise<any>>,
): Array<Statement> => {
  let statements: Array<Statement> = [];

  IN_SQL_BATCH = true;
  statements = operations() as unknown as Array<Statement>;
  IN_SQL_BATCH = false;

  return statements;
};
