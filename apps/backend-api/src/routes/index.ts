import { Application } from 'express';
import authRoutes from './auth';
import blogRoutes from './blog';
import commentRoutes from './comments';
import contactRoutes from './contact';
import challengeRoutes from './challenges';
import githubRoutes from './github';
import analyticsRoutes from './analytics';
import mlRoutes from './ml';
import adminRoutes from './admin';
import securityRoutes from './security';
import { notFoundHandler } from '../middleware/errorHandler';

export const setupRoutes = (app: Application): void => {
  // API routes
  app.use('/api/auth', authRoutes);
  app.use('/api/blog', blogRoutes);
  app.use('/api/comments', commentRoutes);
  app.use('/api/contact', contactRoutes);
  app.use('/api/challenges', challengeRoutes);
  app.use('/api/github', githubRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/ml', mlRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/security', securityRoutes);

  // Catch-all for undefined routes
  app.all('*', notFoundHandler);
};