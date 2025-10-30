import { useMutation } from 'blade/client/hooks';

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
      type="button"
      style={{ cursor: 'pointer' }}>
      Add Post
    </button>
  );
};
