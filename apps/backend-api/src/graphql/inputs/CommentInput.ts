import { InputType, Field, ID } from 'type-graphql';
import { CommentStatus } from '../types/Comment';

@InputType()
export class CreateCommentInput {
  @Field(() => ID)
  postId: string;

  @Field(() => ID, { nullable: true })
  parentId?: string;

  @Field({ nullable: true })
  authorName?: string;

  @Field({ nullable: true })
  authorEmail?: string;

  @Field({ nullable: true })
  authorWebsite?: string;

  @Field()
  content: string;
}

@InputType()
export class UpdateCommentInput {
  @Field({ nullable: true })
  content?: string;

  @Field(() => CommentStatus, { nullable: true })
  status?: CommentStatus;
}

@InputType()
export class CommentFilters {
  @Field(() => ID, { nullable: true })
  postId?: string;

  @Field(() => ID, { nullable: true })
  userId?: string;

  @Field(() => ID, { nullable: true })
  parentId?: string;

  @Field(() => CommentStatus, { nullable: true })
  status?: CommentStatus;

  @Field({ nullable: true })
  includeReplies?: boolean;

  @Field({ nullable: true })
  orderBy?: string;

  @Field({ nullable: true })
  order?: string;
}