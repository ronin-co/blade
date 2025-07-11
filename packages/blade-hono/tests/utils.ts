export const fetcher = async (input: string | Request | URL, _init?: RequestInit) => {
  if (!(input instanceof Request)) throw new Error('Invalid request');

  const { queries } = (await input.json()) as {
    queries: Array<{ get?: { users?: { limitedTo?: number } } }>;
  };

  const numRecords = queries?.[0].get?.users?.limitedTo || 0;
  const records = Array.from({ length: numRecords }).fill(null);

  return new Response(JSON.stringify({ results: [{ records }] }));
};
