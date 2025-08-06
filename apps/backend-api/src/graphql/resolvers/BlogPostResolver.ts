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
import { BlogPost, BlogPostConnection, BlogTag } from '../types/BlogPost';
import { User } from '../types/User';
import { Comment, CommentConnection } from '../types/Comment';
import { CreateBlogPostInput, UpdateBlogPostInput, BlogPostFilters } from '../inputs/BlogPostInput';
import { PaginationInput } from '../inputs/PaginationInput';
import { BlogPostModel } from '../../models/BlogPost';
import { Context } from '../context';

@Resolver(() => BlogPost)
export class BlogPostResolver {
  @Query(() => BlogPostConnection)
  async posts(
    @Arg('filters', () => BlogPostFilters, { nullable: true }) filters?: BlogPostFilters,
    @Arg('pagination', () => PaginationInput, { nullable: true }) pagination?: PaginationInput,
    @Ctx() ctx?: Context
  ): Promise<BlogPostConnection> {
    const page = pagination?.page || 1;
    const limit = Math.min(pagination?.limit || 20, 100);
    const offset = (page - 1) * limit;

    const options = {
      limit,
      offset,
      status: filters?.status,
      visibility: filters?.visibility,
      featured: filters?.featured,
      authorId: filters?.authorId,
      tag: filters?.tag,
      search: filters?.search,
      includeUnpublished: filters?.includeUnpublished || false
    };

    const { posts, total } = await BlogPostModel.findAll(options);

    return {
      posts,
      total,
      page,
      limit,
      hasNextPage: page * limit < total,
      hasPreviousPage: page > 1
    };
  }

  @Query(() => BlogPost, { nullable: true })
  async post(
    @Arg('id', () => ID, { nullable: true }) id?: string,
    @Arg('slug', { nullable: true }) slug?: string,
    @Ctx() ctx?: Context
  ): Promise<BlogPost | null> {
    if (!id && !slug) {
      throw new Error('Either id or slug must be provided');
    }

    if (id) {
      return await BlogPostModel.findById(id);
    }
    
    if (slug) {
      return await BlogPostModel.findBySlug(slug);
    }

    return null;
  }

  @Query(() => [BlogTag])
  async blogTags(): Promise<BlogTag[]> {
    return await BlogPostModel.getAllTags();
  }

  @Authorized('admin', 'editor')
  @Mutation(() => BlogPost)
  async createPost(
    @Arg('input') input: CreateBlogPostInput,
    @Ctx() ctx: Context
  ): Promise<BlogPost> {
    if (!ctx.user) {
      throw new Error('Authentication required');
    }

    return await BlogPostModel.create(ctx.user.id, {
      title: input.title,
      slug: input.slug,
      excerpt: input.excerpt,
      content: input.content,
      status: input.status,
      visibility: input.visibility,
      featured: input.featured,
      featuredImageUrl: input.featuredImageUrl,
      metaTitle: input.metaTitle,
      metaDescription: input.metaDescription,
      metaKeywords: input.metaKeywords,
      tags: input.tags
    });
  }

  @Authorized('admin', 'editor')
  @Mutation(() => BlogPost, { nullable: true })
  async updatePost(
    @Arg('id', () => ID) id: string,
    @Arg('input') input: UpdateBlogPostInput,
    @Ctx() ctx: Context
  ): Promise<BlogPost | null> {
    if (!ctx.user) {
      throw new Error('Authentication required');
    }

    // Check if user can edit this post
    const existingPost = await BlogPostModel.findById(id, true);
    if (!existingPost) {
      throw new Error('Post not found');
    }

    if (existingPost.authorId !== ctx.user.id && ctx.user.role !== 'admin') {
      throw new Error('Insufficient permissions');
    }

    return await BlogPostModel.update(id, {
      title: input.title,
      slug: input.slug,
      excerpt: input.excerpt,
      content: input.content,
      status: input.status,
      visibility: input.visibility,
      featured: input.featured,
      featuredImageUrl: input.featuredImageUrl,
      metaTitle: input.metaTitle,
      metaDescription: input.metaDescription,
      metaKeywords: input.metaKeywords,
      tags: input.tags
    });
  }

  @Authorized('admin', 'editor')
  @Mutation(() => Boolean)
  async deletePost(
    @Arg('id', () => ID) id: string,
    @Ctx() ctx: Context
  ): Promise<boolean> {
    if (!ctx.user) {
      throw new Error('Authentication required');
    }

    // Check if user can delete this post
    const existingPost = await BlogPostModel.findById(id, true);
    if (!existingPost) {
      throw new Error('Post not found');
    }

    if (existingPost.authorId !== ctx.user.id && ctx.user.role !== 'admin') {
      throw new Error('Insufficient permissions');
    }

    return await BlogPostModel.delete(id);
  }

  @Mutation(() => Boolean)
  async likePost(
    @Arg('id', () => ID) id: string,
    @Ctx() ctx: Context
  ): Promise<boolean> {
    // This would require implementing like functionality in the BlogPostModel
    // For now, just increment view count as a placeholder
    await BlogPostModel.incrementViewCount(id);
    return true;
  }

  // Field Resolvers
  @FieldResolver(() => User, { nullable: true })
  async author(
    @Root() post: BlogPost,
    @Ctx() ctx: Context
  ): Promise<User | null> {
    if (post.author) {
      return post.author as User;
    }
    return await ctx.loaders.userLoader.load(post.authorId);
  }

  @FieldResolver(() => [BlogTag], { nullable: true })
  async tags(
    @Root() post: BlogPost,
    @Ctx() ctx: Context
  ): Promise<BlogTag[] | null> {
    if (post.tags) {
      return post.tags;
    }
    return await ctx.loaders.blogTagsLoader.load(post.id);
  }

  @FieldResolver(() => [Comment], { nullable: true })
  async comments(
    @Root() post: BlogPost,
    @Ctx() ctx: Context
  ): Promise<Comment[] | null> {
    if (post.comments) {
      return post.comments as Comment[];
    }
    return await ctx.loaders.commentsByPostLoader.load(post.id);
  }

  @FieldResolver(() => Boolean)
  async isLiked(
    @Root() post: BlogPost,
    @Ctx() ctx: Context
  ): Promise<boolean> {
    // This would require implementing user likes tracking
    // For now, return false as placeholder
    return false;
  }

  @FieldResolver(() => Boolean)
  async canEdit(
    @Root() post: BlogPost,
    @Ctx() ctx: Context
  ): Promise<boolean> {
    if (!ctx.user) {
      return false;
    }

    return post.authorId === ctx.user.id || ctx.user.role === 'admin';
  }
}