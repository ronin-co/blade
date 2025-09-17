import { create } from 'blade/schema';

export default () => [
  create.model({
    slug: 'user',
    fields: {
      name: {
        type: 'string',
      },
    },
  }),
];
