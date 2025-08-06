import { ObjectType, Field, ID, Int, Float, registerEnumType } from 'type-graphql';
import { User } from './User';

export enum ChallengeDifficulty {
  EASY = 'easy',
  MEDIUM = 'medium',
  HARD = 'hard',
  EXPERT = 'expert'
}

export enum SubmissionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  ACCEPTED = 'accepted',
  WRONG_ANSWER = 'wrong_answer',
  TIME_LIMIT_EXCEEDED = 'time_limit_exceeded',
  MEMORY_LIMIT_EXCEEDED = 'memory_limit_exceeded',
  RUNTIME_ERROR = 'runtime_error',
  COMPILATION_ERROR = 'compilation_error',
  SYSTEM_ERROR = 'system_error'
}

registerEnumType(ChallengeDifficulty, {
  name: 'ChallengeDifficulty',
  description: 'Coding challenge difficulty levels'
});

registerEnumType(SubmissionStatus, {
  name: 'SubmissionStatus',
  description: 'Submission status types'
});

@ObjectType()
export class TestCase {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  challengeId: string;

  @Field()
  inputData: string;

  @Field()
  expectedOutput: string;

  @Field()
  isSample: boolean;

  @Field()
  isHidden: boolean;

  @Field(() => Float)
  weight: number;

  @Field({ nullable: true })
  explanation?: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

@ObjectType()
export class CodingChallenge {
  @Field(() => ID)
  id: string;

  @Field()
  title: string;

  @Field()
  slug: string;

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

  @Field(() => Int)
  timeLimitMs: number;

  @Field(() => Int)
  memoryLimitMb: number;

  @Field(() => Int)
  testCasesCount: number;

  @Field(() => Int)
  submissionCount: number;

  @Field(() => Int)
  solvedCount: number;

  @Field(() => Float)
  successRate: number;

  @Field(() => ID)
  authorId: string;

  @Field()
  isActive: boolean;

  @Field()
  isFeatured: boolean;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  // Relations
  @Field(() => User, { nullable: true })
  author?: User;

  @Field(() => [TestCase], { nullable: true })
  testCases?: TestCase[];

  @Field(() => [ChallengeSubmission], { nullable: true })
  submissions?: ChallengeSubmission[];

  // Virtual fields
  @Field()
  isSolved?: boolean;

  @Field()
  canEdit?: boolean;
}

@ObjectType()
export class ChallengeSubmission {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  challengeId: string;

  @Field(() => ID, { nullable: true })
  userId?: string;

  @Field()
  language: string;

  @Field()
  code: string;

  @Field(() => SubmissionStatus)
  status: SubmissionStatus;

  @Field(() => Float)
  score: number;

  @Field(() => Int, { nullable: true })
  executionTimeMs?: number;

  @Field(() => Float, { nullable: true })
  memoryUsedMb?: number;

  @Field(() => Int)
  testCasesPassed: number;

  @Field(() => Int)
  testCasesTotal: number;

  @Field({ nullable: true })
  errorMessage?: string;

  @Field()
  submittedAt: Date;

  @Field({ nullable: true })
  judgedAt?: Date;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  // Relations
  @Field(() => User, { nullable: true })
  user?: User;

  @Field(() => CodingChallenge, { nullable: true })
  challenge?: CodingChallenge;
}

@ObjectType()
export class ChallengeConnection {
  @Field(() => [CodingChallenge])
  challenges: CodingChallenge[];

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

@ObjectType()
export class LeaderboardEntry {
  @Field(() => ID)
  userId: string;

  @Field()
  username: string;

  @Field(() => Float)
  bestScore: number;

  @Field(() => Int, { nullable: true })
  bestTime?: number;

  @Field(() => Int)
  submissions: number;
}

@ObjectType()
export class ChallengeCategory {
  @Field()
  category: string;

  @Field(() => Int)
  count: number;
}