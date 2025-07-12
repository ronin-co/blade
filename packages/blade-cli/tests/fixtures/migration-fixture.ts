import { create } from 'ronin';

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
