import { MultipleWithInstructionsError } from 'blade/errors';
import { triggers } from 'blade/schema';

interface Post {
  body: string;
  id: number;
  title: string;
  userId: number;
}

const posts: Array<Post> = [
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
];

export default triggers<Post>({
  resolvingAdd: ({ query, multipleRecords }) => {
    if (multipleRecords) throw new MultipleWithInstructionsError();
    if (Array.isArray(query.with)) throw new MultipleWithInstructionsError();

    const newPost = {
      body: query.with?.body as string,
      id: posts.length + 1,
      title: query.with?.title as string,
      userId: query.with?.userId as number,
    } satisfies Post;

    posts.push(newPost);

    return newPost;
  },

  resolvingGet: async ({ query, multipleRecords }) => {
    if (Array.isArray(query.with)) throw new MultipleWithInstructionsError();
    const id = Number.parseInt(query.with?.id as string);

    if (multipleRecords) return posts as unknown as Post;

    return posts.find((post) => post.id === id) as Post;
  },
});
