import { Link } from 'blade/components';
import { use, useMetadata } from 'blade/server/hooks';

import { AddPostButton } from '../../components/add-post.client';

const Page = () => {
  useMetadata({
    title: 'Posts',
  });

  const posts = use.posts();

  return (
    <>
      <h1>Posts</h1>
      <AddPostButton />
      <ul>
        {posts.map((post) => (
          <li key={post.id}>
            <Link href={`/posts/${post.id}`}>
              <h3>{post.title}</h3>
            </Link>

            <p>{post.body}</p>
          </li>
        ))}
      </ul>
    </>
  );
};

export default Page;
