import { useMutation } from '@ronin/blade/client/hooks.ts';

export const AddPostButton = () => {
  const { add } = useMutation();

  return (
    <button
      onClick={async () => {
        await add.post.with({
          title: 'New Post',
          body: 'This is a new post.',
          userId: 1,
        });
      }}
      type="button">
      Add Post
    </button>
  );
};
