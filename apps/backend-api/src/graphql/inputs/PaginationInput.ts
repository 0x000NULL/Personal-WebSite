import { InputType, Field, Int } from 'type-graphql';

@InputType()
export class PaginationInput {
  @Field(() => Int, { defaultValue: 1 })
  page?: number;

  @Field(() => Int, { defaultValue: 20 })
  limit?: number;
}

@InputType()
export class SortInput {
  @Field({ nullable: true, defaultValue: 'createdAt' })
  field?: string;

  @Field({ nullable: true, defaultValue: 'desc' })
  direction?: 'asc' | 'desc';
}