import { MultipleWithInstructionsError } from '@ronin/blade/server/utils/errors';

import type { AddTrigger, GetTrigger } from '@ronin/blade/universal/types';

interface Post {
  body: string;
  id: number;
  title: string;
  userId: number;
}

const posts = [
  {
    body: 'quia et suscipit\nsuscipit recusandae consequuntur expedita et cum\nreprehenderit molestiae ut ut quas totam\nnostrum rerum est autem sunt rem eveniet architecto',
    id: 1,
    title: 'sunt aut facere repellat provident occaecati excepturi optio reprehenderit',
    userId: 1,
  },
  {
    body: 'est rerum tempore vitae\nsequi sint nihil reprehenderit dolor beatae ea dolores neque\nfugiat blanditiis voluptate porro vel nihil molestiae ut reiciendis\nqui aperiam non debitis possimus qui neque nisi nulla',
    id: 2,
    title: 'qui est esse',
    userId: 1,
  },
  {
    body: 'et iusto sed quo iure\nvoluptatem occaecati omnis eligendi aut ad\nvoluptatem doloribus vel accusantium quis pariatur\nmolestiae porro eius odio et labore et velit aut',
    id: 3,
    title: 'ea molestias quasi exercitationem repellat qui ipsa sit aut',
    userId: 1,
  },
] satisfies Array<Post>;

export const add: AddTrigger = (query, multiple) => {
  if (multiple) throw new MultipleWithInstructionsError();

  const newPost = {
    body: query.with?.body as string,
    id: posts.length + 1,
    title: query.with?.title as string,
    userId: query.with?.userId as number,
  } satisfies Post;

  posts.push(newPost);

  return newPost;
};

export const get: GetTrigger<Post | null | Array<Post>> = async (query, multiple) => {
  if (multiple) return posts;

  return posts.find((post) => post.id === Number.parseInt(query.with?.id)) ?? null;
};
