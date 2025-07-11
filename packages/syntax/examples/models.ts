import { blob, boolean, date, json, link, model, number, string } from '@/src/schema';

export const Account = model({
  slug: 'account',

  fields: {
    name: string({ required: true }),
    admin: boolean(),
    followers: number(),
    avatar: blob(),
    birthday: date(),
  },

  indexes: {
    name: {
      fields: [{ slug: 'name', order: 'ASC', collation: 'BINARY' }],
      unique: true,
    },
  },
});

export const Profile = model({
  slug: 'profile',

  fields: {
    account: link({
      target: 'account',
      actions: {
        onDelete: 'CASCADE',
        onUpdate: 'NO ACTION',
      },
    }),
    bio: json(),
  },
});

export const Team = model({
  slug: 'team',

  fields: {
    // @ts-expect-error This field is already provided by default.
    id: string(),
  },
});

export const Member = model({
  slug: 'member',

  fields: {
    birthday: date(),
  },

  presets: {
    specificSpace: {
      instructions: {
        with: {
          space: {
            being: 'spa_m9h8oha94helaji',
          },
        },
        selecting: ['name'],
      },
    },
  },
});
