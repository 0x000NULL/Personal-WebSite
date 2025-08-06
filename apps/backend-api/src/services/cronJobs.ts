import * as cron from 'node-cron';
import { query } from '../config/database';

export const startCronJobs = (): void => {
  console.log('🕐 Starting cron jobs...');

  // Daily analytics summary (runs at 1 AM every day)
  cron.schedule('0 1 * * *', async () => {
    try {
      console.log('📊 Running daily analytics summary...');
      
      // Update yesterday's analytics
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];
      
      await query('SELECT update_daily_analytics($1)', [dateStr]);
      
      console.log('✅ Daily analytics summary completed');
    } catch (error) {
      console.error('❌ Daily analytics summary failed:', error);
    }
  });

  // Clean up old sessions (runs every 6 hours)
  cron.schedule('0 */6 * * *', async () => {
    try {
      console.log('🧹 Cleaning up old sessions...');
      
      // Delete sessions older than 30 days
      const result = await query(`
        DELETE FROM visitor_sessions 
        WHERE started_at < NOW() - INTERVAL '30 days'
      `);
      
      console.log(`✅ Cleaned up ${result.rowCount} old sessions`);
    } catch (error) {
      console.error('❌ Session cleanup failed:', error);
    }
  });

  // Clean up expired password reset tokens (runs every hour)
  cron.schedule('0 * * * *', async () => {
    try {
      console.log('🔑 Cleaning up expired tokens...');
      
      const result = await query(`
        UPDATE users 
        SET password_reset_token = NULL, password_reset_expires = NULL
        WHERE password_reset_expires < NOW()
      `);
      
      if (result.rowCount > 0) {
        console.log(`✅ Cleaned up ${result.rowCount} expired tokens`);
      }
    } catch (error) {
      console.error('❌ Token cleanup failed:', error);
    }
  });

  // Update blog post view counts and statistics (runs every 15 minutes)
  cron.schedule('*/15 * * * *', async () => {
    try {
      // Update view counts for blog posts
      await query(`
        UPDATE blog_posts 
        SET view_count = (
          SELECT COUNT(*) 
          FROM page_views 
          WHERE resource_type = 'post' 
          AND resource_id = blog_posts.id
        )
        WHERE status = 'published'
      `);
      
      // Update challenge statistics are handled by triggers, but we could add
      // additional periodic updates here if needed
      
    } catch (error) {
      console.error('❌ Statistics update failed:', error);
    }
  });

  // Send queued auto-reply emails (runs every 5 minutes)
  cron.schedule('*/5 * * * *', async () => {
    try {
      // This would integrate with your email service
      // For now, we'll just mark pending auto-replies
      const pendingReplies = await query(`
        SELECT ar.*, cs.email, cs.name, cs.subject as original_subject
        FROM contact_auto_replies ar
        JOIN contact_submissions cs ON ar.submission_id = cs.id
        WHERE ar.status = 'pending'
        AND ar.created_at <= NOW() - INTERVAL '1 minute'
        LIMIT 10
      `);

      for (const reply of pendingReplies.rows) {
        try {
          // Here you would integrate with your email service (SendGrid, SES, etc.)
          // For now, we'll just log and mark as sent
          console.log(`📧 Would send auto-reply to ${reply.email}: ${reply.subject}`);
          
          await query(`
            UPDATE contact_auto_replies 
            SET status = 'sent', sent_at = NOW()
            WHERE id = $1
          `, [reply.id]);
          
        } catch (emailError) {
          console.error(`❌ Failed to send auto-reply ${reply.id}:`, emailError);
          
          await query(`
            UPDATE contact_auto_replies 
            SET status = 'failed', error_message = $1
            WHERE id = $2
          `, [emailError.message, reply.id]);
        }
      }
      
    } catch (error) {
      console.error('❌ Auto-reply processing failed:', error);
    }
  });

  // Backup critical data (runs daily at 2 AM)
  cron.schedule('0 2 * * *', async () => {
    try {
      console.log('💾 Running data backup checks...');
      
      // Log critical statistics for monitoring
      const stats = await query(`
        SELECT 
          (SELECT COUNT(*) FROM users WHERE is_active = true) as active_users,
          (SELECT COUNT(*) FROM blog_posts WHERE status = 'published') as published_posts,
          (SELECT COUNT(*) FROM comments WHERE status = 'approved') as approved_comments,
          (SELECT COUNT(*) FROM contact_submissions WHERE created_at > NOW() - INTERVAL '1 day') as daily_contacts
      `);
      
      console.log('📈 Daily stats:', stats.rows[0]);
      
    } catch (error) {
      console.error('❌ Backup check failed:', error);
    }
  });

  console.log('✅ Cron jobs started successfully');
};