// Base database entity interface
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

// User entity types
export interface UserEntity extends BaseEntity {
  username: string;
  email: string;
  passwordHash: string;
  firstName?: string;
  lastName?: string;
  bio?: string;
  role: 'user' | 'admin' | 'editor' | 'moderator';
  isActive: boolean;
  isEmailVerified: boolean;
  avatarUrl?: string;
  lastLoginAt?: Date;
  resetToken?: string;
  resetTokenExpiry?: Date;
  verificationToken?: string;
}

export interface CreateUserData {
  username: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  bio?: string;
  role?: 'user' | 'admin' | 'editor' | 'moderator';
}

export interface UpdateUserData {
  username?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  bio?: string;
  role?: 'user' | 'admin' | 'editor' | 'moderator';
  isActive?: boolean;
  isEmailVerified?: boolean;
  avatarUrl?: string;
}

// Blog post entity types
export interface BlogPostEntity extends BaseEntity {
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  contentHtml?: string;
  status: 'draft' | 'published' | 'archived';
  visibility: 'public' | 'private' | 'unlisted';
  featured: boolean;
  featuredImageUrl?: string;
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string;
  tags?: string[];
  authorId: string;
  publishedAt?: Date;
  viewCount: number;
  commentCount: number;
  likeCount: number;
  readingTime?: number;
}

export interface CreateBlogPostData {
  title: string;
  slug?: string;
  excerpt?: string;
  content: string;
  status?: 'draft' | 'published' | 'archived';
  visibility?: 'public' | 'private' | 'unlisted';
  featured?: boolean;
  featuredImageUrl?: string;
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string;
  tags?: string[];
}

export interface UpdateBlogPostData {
  title?: string;
  slug?: string;
  excerpt?: string;
  content?: string;
  status?: 'draft' | 'published' | 'archived';
  visibility?: 'public' | 'private' | 'unlisted';
  featured?: boolean;
  featuredImageUrl?: string;
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string;
  tags?: string[];
}

// Comment entity types
export interface CommentEntity extends BaseEntity {
  postId: string;
  userId?: string;
  parentId?: string;
  authorName?: string;
  authorEmail?: string;
  authorWebsite?: string;
  content: string;
  contentHtml?: string;
  status: 'pending' | 'approved' | 'rejected' | 'spam';
  isGuest: boolean;
  ipAddress?: string;
  userAgent?: string;
  likeCount: number;
  replyCount: number;
  depth: number;
  approvedAt?: Date;
  approvedBy?: string;
}

export interface CreateCommentData {
  postId: string;
  userId?: string;
  parentId?: string;
  authorName?: string;
  authorEmail?: string;
  authorWebsite?: string;
  content: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface UpdateCommentData {
  content?: string;
  status?: 'pending' | 'approved' | 'rejected' | 'spam';
}

// Contact submission entity types
export interface ContactSubmissionEntity extends BaseEntity {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  subject?: string;
  message: string;
  formType: 'general' | 'business' | 'support' | 'collaboration';
  status: 'new' | 'read' | 'replied' | 'resolved' | 'spam' | 'archived';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  source: string;
  ipAddress?: string;
  userAgent?: string;
  referrerUrl?: string;
  spamScore: number;
  isSpam: boolean;
  assignedTo?: string;
  repliedAt?: Date;
  repliedBy?: string;
  replyMessage?: string;
  tags?: string;
  internalNotes?: string;
  attachments: any[];
  customFields: Record<string, any>;
  submittedAt: Date;
}

// Coding challenge entity types
export interface CodingChallengeEntity extends BaseEntity {
  title: string;
  slug: string;
  description: string;
  problemStatement: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  category: string;
  tags?: string;
  inputFormat?: string;
  outputFormat?: string;
  constraints?: string;
  sampleInput?: string;
  sampleOutput?: string;
  explanation?: string;
  hints?: string[];
  timeLimitMs: number;
  memoryLimitMb: number;
  testCasesCount: number;
  submissionCount: number;
  solvedCount: number;
  successRate: number;
  authorId: string;
  isActive: boolean;
  isFeatured: boolean;
}

export interface TestCaseEntity extends BaseEntity {
  challengeId: string;
  inputData: string;
  expectedOutput: string;
  isSample: boolean;
  isHidden: boolean;
  weight: number;
  explanation?: string;
}

export interface ChallengeSubmissionEntity extends BaseEntity {
  challengeId: string;
  userId?: string;
  language: string;
  code: string;
  status: 'pending' | 'running' | 'accepted' | 'wrong_answer' | 'time_limit_exceeded' | 
          'memory_limit_exceeded' | 'runtime_error' | 'compilation_error' | 'system_error';
  score: number;
  executionTimeMs?: number;
  memoryUsedMb?: number;
  testCasesPassed: number;
  testCasesTotal: number;
  errorMessage?: string;
  ipAddress?: string;
  userAgent?: string;
  submittedAt: Date;
  judgedAt?: Date;
}

// Analytics entity types
export interface VisitorSessionEntity extends BaseEntity {
  sessionId: string;
  userId?: string;
  ipAddress: string;
  userAgent?: string;
  deviceType?: 'desktop' | 'mobile' | 'tablet' | 'bot';
  browser?: string;
  browserVersion?: string;
  os?: string;
  osVersion?: string;
  countryCode?: string;
  region?: string;
  city?: string;
  timezone?: string;
  referrerUrl?: string;
  referrerDomain?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  entryPage?: string;
  exitPage?: string;
  pageViews: number;
  sessionDurationSeconds: number;
  isBounce: boolean;
  isNewVisitor: boolean;
  startedAt: Date;
  endedAt?: Date;
}

export interface PageViewEntity extends BaseEntity {
  sessionId: string;
  userId?: string;
  pageUrl: string;
  pagePath: string;
  pageTitle?: string;
  resourceType: 'page' | 'post' | 'challenge' | 'contact' | 'api';
  resourceId?: string;
  method: string;
  statusCode: number;
  responseTimeMs?: number;
  ipAddress?: string;
  userAgent?: string;
  referrerUrl?: string;
  timeOnPageSeconds?: number;
  scrollDepthPercent: number;
  viewedAt: Date;
}

export interface AnalyticsEventEntity extends BaseEntity {
  sessionId?: string;
  userId?: string;
  eventName: string;
  eventCategory?: string;
  eventAction?: string;
  eventLabel?: string;
  eventValue?: number;
  pageUrl?: string;
  customData?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  occurredAt: Date;
}

// Query result types
export interface QueryResult<T> {
  rows: T[];
  rowCount: number;
}

// Database query options
export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  order?: 'ASC' | 'DESC';
  where?: Record<string, any>;
}

// Search and filter types
export interface SearchFilters {
  search?: string;
  category?: string;
  tags?: string[];
  status?: string;
  dateFrom?: Date;
  dateTo?: Date;
  authorId?: string;
}

// Pagination metadata
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// API response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  meta?: PaginationMeta;
  timestamp: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any[];
  };
  requestId: string;
  timestamp: string;
  stack?: string;
}

// Database row mapping utilities
export type DatabaseRow = Record<string, any>;

export interface EntityMapper<T> {
  fromRow(row: DatabaseRow): T;
  toRow(entity: Partial<T>): DatabaseRow;
}