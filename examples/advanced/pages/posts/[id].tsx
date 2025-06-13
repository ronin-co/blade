import { useParams } from '@ronin/blade/hooks';
import { use, useMetadata } from '@ronin/blade/server/hooks';

const Page = () => {
  const { id } = useParams();

  const post = use.post.with.id(id);
  if (!post) return <h1>Post not found</h1>;

  useMetadata({
    title: `Post | ${post.title}`,
  });

  return (
    <>
      <h1>{post.title}</h1>
      <p>{post.body}</p>
    </>
  );
};

export default Page;
