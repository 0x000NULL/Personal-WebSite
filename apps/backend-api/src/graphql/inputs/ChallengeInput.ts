import { InputType, Field, ID, Int } from 'type-graphql';
import { ChallengeDifficulty } from '../types/CodingChallenge';

@InputType()
export class CreateChallengeInput {
  @Field()
  title: string;

  @Field({ nullable: true })
  slug?: string;

  @Field()
  description: string;

  @Field()
  problemStatement: string;

  @Field(() => ChallengeDifficulty)
  difficulty: ChallengeDifficulty;

  @Field()
  category: string;

  @Field({ nullable: true })
  tags?: string;

  @Field({ nullable: true })
  inputFormat?: string;

  @Field({ nullable: true })
  outputFormat?: string;

  @Field({ nullable: true })
  constraints?: string;

  @Field({ nullable: true })
  sampleInput?: string;

  @Field({ nullable: true })
  sampleOutput?: string;

  @Field({ nullable: true })
  explanation?: string;

  @Field(() => [String], { nullable: true })
  hints?: string[];

  @Field(() => Int, { defaultValue: 5000 })
  timeLimitMs?: number;

  @Field(() => Int, { defaultValue: 256 })
  memoryLimitMb?: number;

  @Field({ defaultValue: true })
  isActive?: boolean;

  @Field({ defaultValue: false })
  isFeatured?: boolean;
}

@InputType()
export class UpdateChallengeInput {
  @Field({ nullable: true })
  title?: string;

  @Field({ nullable: true })
  slug?: string;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  problemStatement?: string;

  @Field(() => ChallengeDifficulty, { nullable: true })
  difficulty?: ChallengeDifficulty;

  @Field({ nullable: true })
  category?: string;

  @Field({ nullable: true })
  tags?: string;

  @Field({ nullable: true })
  inputFormat?: string;

  @Field({ nullable: true })
  outputFormat?: string;

  @Field({ nullable: true })
  constraints?: string;

  @Field({ nullable: true })
  sampleInput?: string;

  @Field({ nullable: true })
  sampleOutput?: string;

  @Field({ nullable: true })
  explanation?: string;

  @Field(() => [String], { nullable: true })
  hints?: string[];

  @Field(() => Int, { nullable: true })
  timeLimitMs?: number;

  @Field(() => Int, { nullable: true })
  memoryLimitMb?: number;

  @Field({ nullable: true })
  isActive?: boolean;

  @Field({ nullable: true })
  isFeatured?: boolean;
}

@InputType()
export class SubmitChallengeInput {
  @Field(() => ID)
  challengeId: string;

  @Field()
  language: string;

  @Field()
  code: string;
}

@InputType()
export class ChallengeFilters {
  @Field(() => ChallengeDifficulty, { nullable: true })
  difficulty?: ChallengeDifficulty;

  @Field({ nullable: true })
  category?: string;

  @Field({ nullable: true })
  tag?: string;

  @Field({ nullable: true })
  search?: string;

  @Field({ nullable: true })
  isActive?: boolean;

  @Field({ nullable: true })
  isFeatured?: boolean;

  @Field({ nullable: true })
  orderBy?: string;

  @Field({ nullable: true })
  order?: string;
}