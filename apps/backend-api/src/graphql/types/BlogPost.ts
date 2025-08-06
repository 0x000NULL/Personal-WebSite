import { ObjectType, Field, ID, Int, registerEnumType } from 'type-graphql';
import { User } from './User';
import { Comment } from './Comment';

export enum PostStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived'
}

export enum PostVisibility {
  PUBLIC = 'public',
  PRIVATE = 'private',
  UNLISTED = 'unlisted'
}

registerEnumType(PostStatus, {
  name: 'PostStatus',
  description: 'Blog post status types'
});

registerEnumType(PostVisibility, {
  name: 'PostVisibility',
  description: 'Blog post visibility types'
});

@ObjectType()
export class BlogTag {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  slug: string;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  color?: string;

  @Field(() => Int)
  postCount: number;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

@ObjectType()
export class BlogPost {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  authorId: string;

  @Field()
  title: string;

  @Field()
  slug: string;

  @Field({ nullable: true })
  excerpt?: string;

  @Field()
  content: string;

  @Field({ nullable: true })
  contentHtml?: string;

  @Field(() => PostStatus)
  status: PostStatus;

  @Field(() => PostVisibility)
  visibility: PostVisibility;

  @Field()
  featured: boolean;

  @Field({ nullable: true })
  featuredImageUrl?: string;

  @Field({ nullable: true })
  metaTitle?: string;

  @Field({ nullable: true })
  metaDescription?: string;

  @Field({ nullable: true })
  metaKeywords?: string;

  @Field(() => Int, { nullable: true })
  readingTimeMinutes?: number;

  @Field(() => Int)
  viewCount: number;

  @Field(() => Int)
  likeCount: number;

  @Field(() => Int)
  commentCount: number;

  @Field({ nullable: true })
  publishedAt?: Date;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  // Relations
  @Field(() => User, { nullable: true })
  author?: User;

  @Field(() => [BlogTag], { nullable: true })
  tags?: BlogTag[];

  @Field(() => [Comment], { nullable: true })
  comments?: Comment[];

  // Virtual fields
  @Field()
  isLiked?: boolean;

  @Field()
  canEdit?: boolean;
}

@ObjectType()
export class BlogPostConnection {
  @Field(() => [BlogPost])
  posts: BlogPost[];

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  page: number;

  @Field(() => Int)
  limit: number;

  @Field()
  hasNextPage: boolean;

  @Field()
  hasPreviousPage: boolean;
}