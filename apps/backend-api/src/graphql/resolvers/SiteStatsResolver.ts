import { 
  Resolver, 
  Query, 
  Arg, 
  Ctx, 
  Int,
  Authorized
} from 'type-graphql';
import { 
  SiteStats, 
  AnalyticsOverview,
  PopularPost,
  PopularChallenge,
  RecentActivity,
  DailyStats
} from '../types/SiteStats';
import { Context } from '../context';
import { query } from '../../config/database';

@Resolver(() => SiteStats)
export class SiteStatsResolver {
  @Query(() => SiteStats)
  async siteStats(
    @Ctx() ctx?: Context
  ): Promise<SiteStats> {
    try {
      // Get basic statistics from different tables
      const [
        postsStats,
        commentsStats,
        usersStats,
        challengesStats,
        submissionsStats,
        viewStats
      ] = await Promise.all([
        this.getPostsStats(),
        this.getCommentsStats(),
        this.getUsersStats(),
        this.getChallengesStats(),
        this.getSubmissionsStats(),
        this.getViewStats()
      ]);

      return {
        totalPosts: postsStats.total,
        publishedPosts: postsStats.published,
        totalComments: commentsStats.total,
        approvedComments: commentsStats.approved,
        totalUsers: usersStats.total,
        activeUsers: usersStats.active,
        totalChallenges: challengesStats.total,
        activeChallenges: challengesStats.active,
        totalSubmissions: submissionsStats.total,
        acceptedSubmissions: submissionsStats.accepted,
        overallSuccessRate: submissionsStats.total > 0 ? 
          (submissionsStats.accepted / submissionsStats.total) * 100 : 0,
        totalViews: viewStats.totalViews,
        uniqueVisitors: viewStats.uniqueVisitors,
        totalLikes: viewStats.totalLikes,
        lastUpdated: new Date()
      };
    } catch (error) {
      console.error('Error fetching site stats:', error);
      throw new Error('Failed to fetch site statistics');
    }
  }

  @Authorized('admin', 'editor')
  @Query(() => AnalyticsOverview)
  async analyticsOverview(
    @Arg('days', () => Int, { defaultValue: 30 }) days: number,
    @Ctx() ctx?: Context
  ): Promise<AnalyticsOverview> {
    try {
      const [
        stats,
        popularPosts,
        popularChallenges,
        recentActivity,
        dailyStats
      ] = await Promise.all([
        this.siteStats(),
        this.getPopularPosts(10),
        this.getPopularChallenges(10),
        this.getRecentActivity(20),
        this.getDailyStats(days)
      ]);

      return {
        stats,
        popularPosts,
        popularChallenges,
        recentActivity,
        dailyStats
      };
    } catch (error) {
      console.error('Error fetching analytics overview:', error);
      throw new Error('Failed to fetch analytics overview');
    }
  }

  @Query(() => [PopularPost])
  async popularPosts(
    @Arg('limit', () => Int, { defaultValue: 10 }) limit: number,
    @Ctx() ctx?: Context
  ): Promise<PopularPost[]> {
    return await this.getPopularPosts(Math.min(limit, 50));
  }

  @Query(() => [PopularChallenge])
  async popularChallenges(
    @Arg('limit', () => Int, { defaultValue: 10 }) limit: number,
    @Ctx() ctx?: Context
  ): Promise<PopularChallenge[]> {
    return await this.getPopularChallenges(Math.min(limit, 50));
  }

  @Query(() => [RecentActivity])
  async recentActivity(
    @Arg('limit', () => Int, { defaultValue: 20 }) limit: number,
    @Ctx() ctx?: Context
  ): Promise<RecentActivity[]> {
    return await this.getRecentActivity(Math.min(limit, 100));
  }

  private async getPostsStats(): Promise<{ total: number, published: number }> {
    const result = await query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published
      FROM blog_posts
    `);

    return {
      total: parseInt(result.rows[0].total) || 0,
      published: parseInt(result.rows[0].published) || 0
    };
  }

  private async getCommentsStats(): Promise<{ total: number, approved: number }> {
    const result = await query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved
      FROM comments
    `);

    return {
      total: parseInt(result.rows[0].total) || 0,
      approved: parseInt(result.rows[0].approved) || 0
    };
  }

  private async getUsersStats(): Promise<{ total: number, active: number }> {
    const result = await query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN is_active = true THEN 1 ELSE 0 END) as active
      FROM users
    `);

    return {
      total: parseInt(result.rows[0].total) || 0,
      active: parseInt(result.rows[0].active) || 0
    };
  }

  private async getChallengesStats(): Promise<{ total: number, active: number }> {
    const result = await query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN is_active = true THEN 1 ELSE 0 END) as active
      FROM coding_challenges
    `);

    return {
      total: parseInt(result.rows[0].total) || 0,
      active: parseInt(result.rows[0].active) || 0
    };
  }

  private async getSubmissionsStats(): Promise<{ total: number, accepted: number }> {
    const result = await query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as accepted
      FROM challenge_submissions
    `);

    return {
      total: parseInt(result.rows[0].total) || 0,
      accepted: parseInt(result.rows[0].accepted) || 0
    };
  }

  private async getViewStats(): Promise<{ totalViews: number, uniqueVisitors: number, totalLikes: number }> {
    // This would depend on having analytics tables
    // For now, return calculated values from existing data
    const [postsViews, likesCount] = await Promise.all([
      query('SELECT SUM(view_count) as total_views FROM blog_posts'),
      query('SELECT SUM(like_count) as total_likes FROM blog_posts')
    ]);

    return {
      totalViews: parseInt(postsViews.rows[0].total_views) || 0,
      uniqueVisitors: 0, // Would need analytics data
      totalLikes: parseInt(likesCount.rows[0].total_likes) || 0
    };
  }

  private async getPopularPosts(limit: number): Promise<PopularPost[]> {
    const result = await query(`
      SELECT id, title, slug, view_count, like_count, comment_count, created_at
      FROM blog_posts 
      WHERE status = 'published'
      ORDER BY view_count DESC, like_count DESC
      LIMIT $1
    `, [limit]);

    return result.rows.map(row => ({
      id: row.id,
      title: row.title,
      slug: row.slug,
      viewCount: row.view_count,
      likeCount: row.like_count,
      commentCount: row.comment_count,
      createdAt: row.created_at
    }));
  }

  private async getPopularChallenges(limit: number): Promise<PopularChallenge[]> {
    const result = await query(`
      SELECT id, title, slug, submission_count, solved_count, success_rate, created_at
      FROM coding_challenges 
      WHERE is_active = true
      ORDER BY submission_count DESC, solved_count DESC
      LIMIT $1
    `, [limit]);

    return result.rows.map(row => ({
      id: row.id,
      title: row.title,
      slug: row.slug,
      submissionCount: row.submission_count,
      solvedCount: row.solved_count,
      successRate: parseFloat(row.success_rate),
      createdAt: row.created_at
    }));
  }

  private async getRecentActivity(limit: number): Promise<RecentActivity[]> {
    // This is a simplified version - in a real app you'd have a dedicated activity feed
    const activities: RecentActivity[] = [];

    // Recent posts
    const recentPosts = await query(`
      SELECT bp.id, bp.title, bp.created_at, u.username
      FROM blog_posts bp
      JOIN users u ON bp.author_id = u.id
      WHERE bp.status = 'published'
      ORDER BY bp.created_at DESC
      LIMIT $1
    `, [Math.ceil(limit / 4)]);

    activities.push(...recentPosts.rows.map(row => ({
      id: `post-${row.id}`,
      type: 'post',
      title: `New Post: ${row.title}`,
      description: `Published by ${row.username}`,
      userId: null,
      username: row.username,
      createdAt: row.created_at
    })));

    // Recent comments
    const recentComments = await query(`
      SELECT c.id, c.content, c.created_at, u.username, bp.title as post_title
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
      JOIN blog_posts bp ON c.post_id = bp.id
      WHERE c.status = 'approved'
      ORDER BY c.created_at DESC
      LIMIT $1
    `, [Math.ceil(limit / 4)]);

    activities.push(...recentComments.rows.map(row => ({
      id: `comment-${row.id}`,
      type: 'comment',
      title: `New Comment on "${row.post_title}"`,
      description: row.content.substring(0, 100) + (row.content.length > 100 ? '...' : ''),
      userId: null,
      username: row.username || 'Anonymous',
      createdAt: row.created_at
    })));

    // Recent submissions
    const recentSubmissions = await query(`
      SELECT cs.id, cs.status, cs.created_at, u.username, cc.title as challenge_title
      FROM challenge_submissions cs
      LEFT JOIN users u ON cs.user_id = u.id
      JOIN coding_challenges cc ON cs.challenge_id = cc.id
      ORDER BY cs.created_at DESC
      LIMIT $1
    `, [Math.ceil(limit / 4)]);

    activities.push(...recentSubmissions.rows.map(row => ({
      id: `submission-${row.id}`,
      type: 'submission',
      title: `Challenge Submission: ${row.challenge_title}`,
      description: `Status: ${row.status}`,
      userId: null,
      username: row.username || 'Anonymous',
      createdAt: row.created_at
    })));

    // Recent user signups
    const recentUsers = await query(`
      SELECT id, username, created_at
      FROM users
      WHERE is_active = true
      ORDER BY created_at DESC
      LIMIT $1
    `, [Math.ceil(limit / 4)]);

    activities.push(...recentUsers.rows.map(row => ({
      id: `user-${row.id}`,
      type: 'user_signup',
      title: 'New User Joined',
      description: `Welcome ${row.username}!`,
      userId: row.id,
      username: row.username,
      createdAt: row.created_at
    })));

    // Sort by date and limit
    return activities
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  private async getDailyStats(days: number): Promise<DailyStats[]> {
    // This would require having analytics tables that track daily metrics
    // For now, return empty array as placeholder
    const stats: DailyStats[] = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      stats.push({
        date,
        views: 0, // Would come from analytics
        visitors: 0, // Would come from analytics
        submissions: 0, // Would come from submissions table
        newUsers: 0, // Would come from users table
        newPosts: 0, // Would come from posts table
        newComments: 0 // Would come from comments table
      });
    }

    return stats;
  }
}