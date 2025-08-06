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
import { 
  CodingChallenge, 
  ChallengeConnection, 
  ChallengeSubmission, 
  TestCase,
  LeaderboardEntry,
  ChallengeCategory
} from '../types/CodingChallenge';
import { User } from '../types/User';
import { 
  CreateChallengeInput, 
  UpdateChallengeInput, 
  SubmitChallengeInput,
  ChallengeFilters 
} from '../inputs/ChallengeInput';
import { PaginationInput } from '../inputs/PaginationInput';
import { CodingChallengeModel } from '../../models/CodingChallenge';
import { Context } from '../context';

@Resolver(() => CodingChallenge)
export class ChallengeResolver {
  @Query(() => ChallengeConnection)
  async challenges(
    @Arg('filters', () => ChallengeFilters, { nullable: true }) filters?: ChallengeFilters,
    @Arg('pagination', () => PaginationInput, { nullable: true }) pagination?: PaginationInput,
    @Ctx() ctx?: Context
  ): Promise<ChallengeConnection> {
    const page = pagination?.page || 1;
    const limit = Math.min(pagination?.limit || 20, 100);
    const offset = (page - 1) * limit;

    const options = {
      difficulty: filters?.difficulty,
      category: filters?.category,
      tag: filters?.tag,
      search: filters?.search,
      isActive: filters?.isActive !== false,
      isFeatured: filters?.isFeatured,
      limit,
      offset,
      orderBy: filters?.orderBy as any || 'createdAt',
      order: filters?.order as 'asc' | 'desc' || 'desc'
    };

    const { challenges, total } = await CodingChallengeModel.findAll(options);

    return {
      challenges,
      total,
      page,
      limit,
      hasNextPage: page * limit < total,
      hasPreviousPage: page > 1
    };
  }

  @Query(() => CodingChallenge, { nullable: true })
  async challenge(
    @Arg('id', () => ID, { nullable: true }) id?: string,
    @Arg('slug', { nullable: true }) slug?: string,
    @Ctx() ctx?: Context
  ): Promise<CodingChallenge | null> {
    if (!id && !slug) {
      throw new Error('Either id or slug must be provided');
    }

    if (id) {
      return await CodingChallengeModel.findById(id);
    }
    
    if (slug) {
      return await CodingChallengeModel.findBySlug(slug);
    }

    return null;
  }

  @Query(() => [ChallengeCategory])
  async challengeCategories(): Promise<ChallengeCategory[]> {
    return await CodingChallengeModel.getCategories();
  }

  @Query(() => [LeaderboardEntry])
  async challengeLeaderboard(
    @Arg('challengeId', () => ID) challengeId: string,
    @Arg('limit', () => Int, { defaultValue: 10 }) limit: number,
    @Ctx() ctx?: Context
  ): Promise<LeaderboardEntry[]> {
    return await CodingChallengeModel.getLeaderboard(challengeId, Math.min(limit, 100));
  }

  @Authorized('admin', 'editor')
  @Mutation(() => CodingChallenge)
  async createChallenge(
    @Arg('input') input: CreateChallengeInput,
    @Ctx() ctx: Context
  ): Promise<CodingChallenge> {
    if (!ctx.user) {
      throw new Error('Authentication required');
    }

    return await CodingChallengeModel.create(ctx.user.id, {
      title: input.title,
      slug: input.slug,
      description: input.description,
      problemStatement: input.problemStatement,
      difficulty: input.difficulty,
      category: input.category,
      tags: input.tags,
      inputFormat: input.inputFormat,
      outputFormat: input.outputFormat,
      constraints: input.constraints,
      sampleInput: input.sampleInput,
      sampleOutput: input.sampleOutput,
      explanation: input.explanation,
      hints: input.hints,
      timeLimitMs: input.timeLimitMs,
      memoryLimitMb: input.memoryLimitMb,
      isActive: input.isActive,
      isFeatured: input.isFeatured
    });
  }

  @Authorized('admin', 'editor')
  @Mutation(() => CodingChallenge, { nullable: true })
  async updateChallenge(
    @Arg('id', () => ID) id: string,
    @Arg('input') input: UpdateChallengeInput,
    @Ctx() ctx: Context
  ): Promise<CodingChallenge | null> {
    if (!ctx.user) {
      throw new Error('Authentication required');
    }

    // Check if user can edit this challenge
    const existingChallenge = await CodingChallengeModel.findById(id);
    if (!existingChallenge) {
      throw new Error('Challenge not found');
    }

    if (existingChallenge.authorId !== ctx.user.id && ctx.user.role !== 'admin') {
      throw new Error('Insufficient permissions');
    }

    return await CodingChallengeModel.update(id, {
      title: input.title,
      slug: input.slug,
      description: input.description,
      problemStatement: input.problemStatement,
      difficulty: input.difficulty,
      category: input.category,
      tags: input.tags,
      inputFormat: input.inputFormat,
      outputFormat: input.outputFormat,
      constraints: input.constraints,
      sampleInput: input.sampleInput,
      sampleOutput: input.sampleOutput,
      explanation: input.explanation,
      hints: input.hints,
      timeLimitMs: input.timeLimitMs,
      memoryLimitMb: input.memoryLimitMb,
      isActive: input.isActive,
      isFeatured: input.isFeatured
    });
  }

  @Authorized('admin', 'editor')
  @Mutation(() => Boolean)
  async deleteChallenge(
    @Arg('id', () => ID) id: string,
    @Ctx() ctx: Context
  ): Promise<boolean> {
    if (!ctx.user) {
      throw new Error('Authentication required');
    }

    // Check if user can delete this challenge
    const existingChallenge = await CodingChallengeModel.findById(id);
    if (!existingChallenge) {
      throw new Error('Challenge not found');
    }

    if (existingChallenge.authorId !== ctx.user.id && ctx.user.role !== 'admin') {
      throw new Error('Insufficient permissions');
    }

    return await CodingChallengeModel.delete(id);
  }

  @Mutation(() => ChallengeSubmission)
  async submitChallenge(
    @Arg('input') input: SubmitChallengeInput,
    @Ctx() ctx: Context
  ): Promise<ChallengeSubmission> {
    const submissionData = {
      challengeId: input.challengeId,
      userId: ctx.user?.id,
      language: input.language,
      code: input.code,
      ipAddress: ctx.req?.ip,
      userAgent: ctx.req?.get('User-Agent')
    };

    const submission = await CodingChallengeModel.createSubmission(submissionData);

    // Here you would typically trigger the code execution and judging process
    // For now, we'll just return the submission
    
    return submission;
  }

  @Query(() => ChallengeSubmission, { nullable: true })
  async submission(
    @Arg('id', () => ID) id: string,
    @Ctx() ctx?: Context
  ): Promise<ChallengeSubmission | null> {
    return await CodingChallengeModel.getSubmission(id);
  }

  @Authorized()
  @Query(() => [ChallengeSubmission])
  async mySubmissions(
    @Arg('challengeId', () => ID, { nullable: true }) challengeId?: string,
    @Ctx() ctx?: Context
  ): Promise<ChallengeSubmission[]> {
    if (!ctx?.user) {
      throw new Error('Authentication required');
    }

    return await CodingChallengeModel.getUserSubmissions(ctx.user.id, challengeId);
  }

  // Field Resolvers
  @FieldResolver(() => User, { nullable: true })
  async author(
    @Root() challenge: CodingChallenge,
    @Ctx() ctx: Context
  ): Promise<User | null> {
    if (challenge.author) {
      return challenge.author as User;
    }
    return await ctx.loaders.userLoader.load(challenge.authorId);
  }

  @FieldResolver(() => [TestCase], { nullable: true })
  async testCases(
    @Root() challenge: CodingChallenge,
    @Ctx() ctx: Context
  ): Promise<TestCase[] | null> {
    if (challenge.testCases) {
      return challenge.testCases;
    }
    return await ctx.loaders.testCasesLoader.load(challenge.id);
  }

  @FieldResolver(() => [ChallengeSubmission], { nullable: true })
  async submissions(
    @Root() challenge: CodingChallenge,
    @Ctx() ctx: Context
  ): Promise<ChallengeSubmission[] | null> {
    if (challenge.submissions) {
      return challenge.submissions;
    }

    if (!ctx.user) {
      return null;
    }

    return await ctx.loaders.submissionsByUserAndChallengeLoader.load(
      `${ctx.user.id}:${challenge.id}`
    );
  }

  @FieldResolver(() => Boolean)
  async isSolved(
    @Root() challenge: CodingChallenge,
    @Ctx() ctx: Context
  ): Promise<boolean> {
    if (!ctx.user) {
      return false;
    }

    const submissions = await ctx.loaders.submissionsByUserAndChallengeLoader.load(
      `${ctx.user.id}:${challenge.id}`
    );

    return submissions.some(sub => sub.status === 'accepted');
  }

  @FieldResolver(() => Boolean)
  async canEdit(
    @Root() challenge: CodingChallenge,
    @Ctx() ctx: Context
  ): Promise<boolean> {
    if (!ctx.user) {
      return false;
    }

    return challenge.authorId === ctx.user.id || ctx.user.role === 'admin';
  }
}

@Resolver(() => ChallengeSubmission)
export class ChallengeSubmissionResolver {
  @FieldResolver(() => User, { nullable: true })
  async user(
    @Root() submission: ChallengeSubmission,
    @Ctx() ctx: Context
  ): Promise<User | null> {
    if (submission.user) {
      return submission.user as User;
    }

    if (!submission.userId) {
      return null;
    }

    return await ctx.loaders.userLoader.load(submission.userId);
  }

  @FieldResolver(() => CodingChallenge, { nullable: true })
  async challenge(
    @Root() submission: ChallengeSubmission,
    @Ctx() ctx: Context
  ): Promise<CodingChallenge | null> {
    if (submission.challenge) {
      return submission.challenge;
    }
    return await ctx.loaders.challengeLoader.load(submission.challengeId);
  }
}