import DataLoader from 'dataloader';
import { UserModel } from '../../models/User';
import { BlogPostModel } from '../../models/BlogPost';
import { CommentModel } from '../../models/Comment';
import { CodingChallengeModel } from '../../models/CodingChallenge';

// User DataLoaders
export const createUserLoader = () => new DataLoader(async (userIds: readonly string[]) => {
  const users = await Promise.all(
    userIds.map(id => UserModel.findById(id))
  );
  return users;
});

export const createUserByEmailLoader = () => new DataLoader(async (emails: readonly string[]) => {
  const users = await Promise.all(
    emails.map(email => UserModel.findByEmail(email))
  );
  return users;
});

// BlogPost DataLoaders
export const createBlogPostLoader = () => new DataLoader(async (postIds: readonly string[]) => {
  const posts = await Promise.all(
    postIds.map(id => BlogPostModel.findById(id))
  );
  return posts;
});

export const createBlogPostsByAuthorLoader = () => new DataLoader(async (authorIds: readonly string[]) => {
  const postsByAuthor = await Promise.all(
    authorIds.map(async authorId => {
      const result = await BlogPostModel.findAll({ authorId, limit: 100 });
      return result.posts;
    })
  );
  return postsByAuthor;
});

export const createBlogTagsLoader = () => new DataLoader(async (postIds: readonly string[]) => {
  const tagsByPost = await Promise.all(
    postIds.map(async postId => {
      // This would require implementing a method to get tags by post ID
      // For now, return empty array - this can be implemented later
      return [];
    })
  );
  return tagsByPost;
});

// Comment DataLoaders
export const createCommentLoader = () => new DataLoader(async (commentIds: readonly string[]) => {
  const comments = await Promise.all(
    commentIds.map(id => CommentModel.findById(id))
  );
  return comments;
});

export const createCommentsByPostLoader = () => new DataLoader(async (postIds: readonly string[]) => {
  const commentsByPost = await Promise.all(
    postIds.map(async postId => {
      const result = await CommentModel.findAll({ 
        postId, 
        status: 'approved',
        limit: 100 
      });
      return result.comments;
    })
  );
  return commentsByPost;
});

export const createCommentsByUserLoader = () => new DataLoader(async (userIds: readonly string[]) => {
  const commentsByUser = await Promise.all(
    userIds.map(async userId => {
      const result = await CommentModel.findAll({ 
        userId, 
        status: 'approved',
        limit: 100 
      });
      return result.comments;
    })
  );
  return commentsByUser;
});

export const createCommentRepliesLoader = () => new DataLoader(async (parentIds: readonly string[]) => {
  const repliesByParent = await Promise.all(
    parentIds.map(async parentId => {
      return await CommentModel.findReplies(parentId);
    })
  );
  return repliesByParent;
});

// CodingChallenge DataLoaders
export const createChallengeLoader = () => new DataLoader(async (challengeIds: readonly string[]) => {
  const challenges = await Promise.all(
    challengeIds.map(id => CodingChallengeModel.findById(id))
  );
  return challenges;
});

export const createChallengesByAuthorLoader = () => new DataLoader(async (authorIds: readonly string[]) => {
  const challengesByAuthor = await Promise.all(
    authorIds.map(async authorId => {
      const result = await CodingChallengeModel.findAll({ 
        orderBy: 'createdAt',
        order: 'desc',
        limit: 100 
      });
      // Filter by author on the returned results since the model doesn't support author filtering directly
      return result.challenges.filter(c => c.authorId === authorId);
    })
  );
  return challengesByAuthor;
});

export const createSubmissionsByUserLoader = () => new DataLoader(async (userIds: readonly string[]) => {
  const submissionsByUser = await Promise.all(
    userIds.map(async userId => {
      return await CodingChallengeModel.getUserSubmissions(userId);
    })
  );
  return submissionsByUser;
});

export const createSubmissionsByUserAndChallengeLoader = () => new DataLoader(async (keys: readonly string[]) => {
  // Keys are in format "userId:challengeId"
  const submissions = await Promise.all(
    keys.map(async key => {
      const [userId, challengeId] = key.split(':');
      return await CodingChallengeModel.getUserSubmissions(userId, challengeId);
    })
  );
  return submissions;
});

// Test Cases DataLoader
export const createTestCasesLoader = () => new DataLoader(async (challengeIds: readonly string[]) => {
  const testCasesByChallenge = await Promise.all(
    challengeIds.map(async challengeId => {
      return await CodingChallengeModel.getTestCases(challengeId, false); // Don't include hidden test cases
    })
  );
  return testCasesByChallenge;
});

// Leaderboard DataLoader
export const createLeaderboardLoader = () => new DataLoader(async (challengeIds: readonly string[]) => {
  const leaderboardsByChallenge = await Promise.all(
    challengeIds.map(async challengeId => {
      return await CodingChallengeModel.getLeaderboard(challengeId, 10);
    })
  );
  return leaderboardsByChallenge;
});

// Helper function to create all dataloaders for context
export function createDataLoaders() {
  return {
    // User loaders
    userLoader: createUserLoader(),
    userByEmailLoader: createUserByEmailLoader(),
    
    // BlogPost loaders
    blogPostLoader: createBlogPostLoader(),
    blogPostsByAuthorLoader: createBlogPostsByAuthorLoader(),
    blogTagsLoader: createBlogTagsLoader(),
    
    // Comment loaders
    commentLoader: createCommentLoader(),
    commentsByPostLoader: createCommentsByPostLoader(),
    commentsByUserLoader: createCommentsByUserLoader(),
    commentRepliesLoader: createCommentRepliesLoader(),
    
    // Challenge loaders
    challengeLoader: createChallengeLoader(),
    challengesByAuthorLoader: createChallengesByAuthorLoader(),
    submissionsByUserLoader: createSubmissionsByUserLoader(),
    submissionsByUserAndChallengeLoader: createSubmissionsByUserAndChallengeLoader(),
    testCasesLoader: createTestCasesLoader(),
    leaderboardLoader: createLeaderboardLoader(),
  };
}

export type DataLoaders = ReturnType<typeof createDataLoaders>;