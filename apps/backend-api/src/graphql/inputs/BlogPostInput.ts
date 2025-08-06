import { InputType, Field, ID } from 'type-graphql';
import { PostStatus, PostVisibility } from '../types/BlogPost';

@InputType()
export class CreateBlogPostInput {
  @Field()
  title: string;

  @Field({ nullable: true })
  slug?: string;

  @Field({ nullable: true })
  excerpt?: string;

  @Field()
  content: string;

  @Field(() => PostStatus, { defaultValue: PostStatus.DRAFT })
  status?: PostStatus;

  @Field(() => PostVisibility, { defaultValue: PostVisibility.PUBLIC })
  visibility?: PostVisibility;

  @Field({ defaultValue: false })
  featured?: boolean;

  @Field({ nullable: true })
  featuredImageUrl?: string;

  @Field({ nullable: true })
  metaTitle?: string;

  @Field({ nullable: true })
  metaDescription?: string;

  @Field({ nullable: true })
  metaKeywords?: string;

  @Field(() => [String], { nullable: true })
  tags?: string[];
}

@InputType()
export class UpdateBlogPostInput {
  @Field({ nullable: true })
  title?: string;

  @Field({ nullable: true })
  slug?: string;

  @Field({ nullable: true })
  excerpt?: string;

  @Field({ nullable: true })
  content?: string;

  @Field(() => PostStatus, { nullable: true })
  status?: PostStatus;

  @Field(() => PostVisibility, { nullable: true })
  visibility?: PostVisibility;

  @Field({ nullable: true })
  featured?: boolean;

  @Field({ nullable: true })
  featuredImageUrl?: string;

  @Field({ nullable: true })
  metaTitle?: string;

  @Field({ nullable: true })
  metaDescription?: string;

  @Field({ nullable: true })
  metaKeywords?: string;

  @Field(() => [String], { nullable: true })
  tags?: string[];
}

@InputType()
export class BlogPostFilters {
  @Field(() => PostStatus, { nullable: true })
  status?: PostStatus;

  @Field(() => PostVisibility, { nullable: true })
  visibility?: PostVisibility;

  @Field({ nullable: true })
  featured?: boolean;

  @Field(() => ID, { nullable: true })
  authorId?: string;

  @Field({ nullable: true })
  tag?: string;

  @Field({ nullable: true })
  search?: string;

  @Field({ nullable: true })
  includeUnpublished?: boolean;
}