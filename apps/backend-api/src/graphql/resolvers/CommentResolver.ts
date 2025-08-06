import { 
  Resolver, 
  Query, 
  Mutation, 
  Arg, 
  Ctx, 
  FieldResolver, 
  Root,
  Int,
  Authorized,
  ID
} from 'type-graphql';
import { Comment, CommentConnection, CommentStats } from '../types/Comment';
import { User } from '../types/User';
import { BlogPost } from '../types/BlogPost';
import { CreateCommentInput, UpdateCommentInput, CommentFilters } from '../inputs/CommentInput';
import { PaginationInput } from '../inputs/PaginationInput';
import { CommentModel } from '../../models/Comment';
import { Context } from '../context';

@Resolver(() => Comment)
export class CommentResolver {
  @Query(() => CommentConnection)
  async comments(
    @Arg('filters', () => CommentFilters, { nullable: true }) filters?: CommentFilters,
    @Arg('pagination', () => PaginationInput, { nullable: true }) pagination?: PaginationInput,
    @Ctx() ctx?: Context
  ): Promise<CommentConnection> {
    const page = pagination?.page || 1;
    const limit = Math.min(pagination?.limit || 20, 100);
    const offset = (page - 1) * limit;

    const options = {
      postId: filters?.postId,
      userId: filters?.userId,
      parentId: filters?.parentId,
      status: filters?.status || 'approved',
      limit,
      offset,
      includeReplies: filters?.includeReplies || false,
      orderBy: filters?.orderBy as 'createdAt' | 'likeCount' || 'createdAt',
      order: filters?.order as 'asc' | 'desc' || 'desc'
    };

    const { comments, total } = await CommentModel.findAll(options);

    return {
      comments,
      total,
      page,
      limit,
      hasNextPage: page * limit < total,
      hasPreviousPage: page > 1
    };
  }

  @Query(() => Comment, { nullable: true })
  async comment(
    @Arg('id', () => ID) id: string,
    @Arg('includeReplies', { defaultValue: false }) includeReplies: boolean,
    @Ctx() ctx?: Context
  ): Promise<Comment | null> {
    return await CommentModel.findById(id, includeReplies);
  }

  @Query(() => CommentStats)
  async commentStats(
    @Arg('postId', () => ID) postId: string,
    @Ctx() ctx?: Context
  ): Promise<CommentStats> {
    return await CommentModel.getCommentStats(postId);
  }

  @Mutation(() => Comment)
  async addComment(
    @Arg('input') input: CreateCommentInput,
    @Ctx() ctx: Context
  ): Promise<Comment> {
    const commentData = {
      postId: input.postId,
      parentId: input.parentId,
      content: input.content,
      userId: ctx.user?.id,
      authorName: input.authorName || ctx.user?.username,
      authorEmail: input.authorEmail || ctx.user?.email,
      authorWebsite: input.authorWebsite,
      ipAddress: ctx.req?.ip,
      userAgent: ctx.req?.get('User-Agent')
    };

    return await CommentModel.create(commentData);
  }

  @Authorized()
  @Mutation(() => Comment, { nullable: true })
  async updateComment(
    @Arg('id', () => ID) id: string,
    @Arg('input') input: UpdateCommentInput,
    @Ctx() ctx: Context
  ): Promise<Comment | null> {
    if (!ctx.user) {
      throw new Error('Authentication required');
    }

    // Check if user can edit this comment
    const existingComment = await CommentModel.findById(id);
    if (!existingComment) {
      throw new Error('Comment not found');
    }

    const canEdit = existingComment.userId === ctx.user.id || 
                   ctx.user.role === 'admin' || 
                   ctx.user.role === 'editor';

    if (!canEdit) {
      throw new Error('Insufficient permissions');
    }

    return await CommentModel.update(id, {
      content: input.content,
      status: input.status
    });
  }

  @Authorized()
  @Mutation(() => Boolean)
  async deleteComment(
    @Arg('id', () => ID) id: string,
    @Ctx() ctx: Context
  ): Promise<boolean> {
    if (!ctx.user) {
      throw new Error('Authentication required');
    }

    // Check if user can delete this comment
    const existingComment = await CommentModel.findById(id);
    if (!existingComment) {
      throw new Error('Comment not found');
    }

    const canDelete = existingComment.userId === ctx.user.id || 
                     ctx.user.role === 'admin' || 
                     ctx.user.role === 'editor';

    if (!canDelete) {
      throw new Error('Insufficient permissions');
    }

    return await CommentModel.delete(id);
  }

  @Authorized('admin', 'editor')
  @Mutation(() => Comment, { nullable: true })
  async moderateComment(
    @Arg('id', () => ID) id: string,
    @Arg('status') status: 'approved' | 'rejected' | 'spam',
    @Ctx() ctx: Context
  ): Promise<Comment | null> {
    if (!ctx.user) {
      throw new Error('Authentication required');
    }

    return await CommentModel.moderate(id, status, ctx.user.id);
  }

  @Mutation(() => Boolean)
  async likeComment(
    @Arg('id', () => ID) id: string,
    @Ctx() ctx: Context
  ): Promise<boolean> {
    await CommentModel.incrementLikeCount(id);
    return true;
  }

  // Field Resolvers
  @FieldResolver(() => User, { nullable: true })
  async author(
    @Root() comment: Comment,
    @Ctx() ctx: Context
  ): Promise<User | null> {
    if (comment.author) {
      return comment.author as User;
    }
    
    if (!comment.userId) {
      return null;
    }

    return await ctx.loaders.userLoader.load(comment.userId);
  }

  @FieldResolver(() => Comment, { nullable: true })
  async parent(
    @Root() comment: Comment,
    @Ctx() ctx: Context
  ): Promise<Comment | null> {
    if (comment.parent) {
      return comment.parent;
    }

    if (!comment.parentId) {
      return null;
    }

    return await ctx.loaders.commentLoader.load(comment.parentId);
  }

  @FieldResolver(() => [Comment], { nullable: true })
  async replies(
    @Root() comment: Comment,
    @Ctx() ctx: Context
  ): Promise<Comment[] | null> {
    if (comment.replies) {
      return comment.replies;
    }

    return await ctx.loaders.commentRepliesLoader.load(comment.id);
  }

  @FieldResolver(() => Boolean)
  async isLiked(
    @Root() comment: Comment,
    @Ctx() ctx: Context
  ): Promise<boolean> {
    // This would require implementing user likes tracking
    // For now, return false as placeholder
    return false;
  }

  @FieldResolver(() => Boolean)
  async canEdit(
    @Root() comment: Comment,
    @Ctx() ctx: Context
  ): Promise<boolean> {
    if (!ctx.user) {
      return false;
    }

    return comment.userId === ctx.user.id || 
           ctx.user.role === 'admin' || 
           ctx.user.role === 'editor';
  }

  @FieldResolver(() => Boolean)
  async canModerate(
    @Root() comment: Comment,
    @Ctx() ctx: Context
  ): Promise<boolean> {
    if (!ctx.user) {
      return false;
    }

    return ctx.user.role === 'admin' || ctx.user.role === 'editor';
  }
}