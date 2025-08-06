import { Router, Request, Response, NextFunction } from 'express';
import axios from 'axios';
import { createError } from '../middleware/errorHandler';
import { rateLimiter } from '../middleware/rateLimiter';

const router = Router();

// GitHub API configuration
const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_USERNAME = process.env.GITHUB_USERNAME || 'github';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

// Create axios instance with default headers
const githubApi = axios.create({
  baseURL: GITHUB_API_BASE,
  headers: {
    'Accept': 'application/vnd.github.v3+json',
    ...(GITHUB_TOKEN && { 'Authorization': `Bearer ${GITHUB_TOKEN}` })
  }
});

// Cache configuration
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 3600000; // 1 hour in milliseconds

// Helper function to get cached data
function getCachedData(key: string): any | null {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  cache.delete(key);
  return null;
}

// Helper function to set cache
function setCacheData(key: string, data: any): void {
  cache.set(key, { data, timestamp: Date.now() });
}

/**
 * @swagger
 * /api/github/profile:
 *   get:
 *     summary: Get GitHub profile information
 *     tags: [GitHub]
 *     responses:
 *       200:
 *         description: GitHub profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 login:
 *                   type: string
 *                 name:
 *                   type: string
 *                 avatar_url:
 *                   type: string
 *                 bio:
 *                   type: string
 *                 company:
 *                   type: string
 *                 location:
 *                   type: string
 *                 email:
 *                   type: string
 *                 blog:
 *                   type: string
 *                 public_repos:
 *                   type: integer
 *                 followers:
 *                   type: integer
 *                 following:
 *                   type: integer
 *                 created_at:
 *                   type: string
 *                   format: date-time
 *       500:
 *         description: Failed to fetch GitHub profile
 */
router.get('/profile', rateLimiter.api, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cacheKey = `profile:${GITHUB_USERNAME}`;
    const cachedData = getCachedData(cacheKey);
    
    if (cachedData) {
      return res.json(cachedData);
    }

    const response = await githubApi.get(`/users/${GITHUB_USERNAME}`);
    const profile = response.data;

    setCacheData(cacheKey, profile);

    res.json(profile);
  } catch (error) {
    console.error('GitHub API error:', error);
    next(createError('Failed to fetch GitHub profile', 500));
  }
});

/**
 * @swagger
 * /api/github/repos:
 *   get:
 *     summary: Get GitHub repositories
 *     tags: [GitHub]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: per_page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 30
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [created, updated, pushed, full_name]
 *           default: updated
 *       - in: query
 *         name: direction
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [all, owner, member]
 *           default: owner
 *     responses:
 *       200:
 *         description: Repositories retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 repos:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       name:
 *                         type: string
 *                       full_name:
 *                         type: string
 *                       description:
 *                         type: string
 *                       html_url:
 *                         type: string
 *                       language:
 *                         type: string
 *                       stargazers_count:
 *                         type: integer
 *                       forks_count:
 *                         type: integer
 *                       watchers_count:
 *                         type: integer
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                       updated_at:
 *                         type: string
 *                         format: date-time
 *                       pushed_at:
 *                         type: string
 *                         format: date-time
 *                       topics:
 *                         type: array
 *                         items:
 *                           type: string
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     per_page:
 *                       type: integer
 *                     total:
 *                       type: integer
 *       500:
 *         description: Failed to fetch repositories
 */
router.get('/repos', rateLimiter.api, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const per_page = Math.min(parseInt(req.query.per_page as string) || 30, 100);
    const sort = req.query.sort || 'updated';
    const direction = req.query.direction || 'desc';
    const type = req.query.type || 'owner';

    const cacheKey = `repos:${GITHUB_USERNAME}:${page}:${per_page}:${sort}:${direction}:${type}`;
    const cachedData = getCachedData(cacheKey);
    
    if (cachedData) {
      return res.json(cachedData);
    }

    const response = await githubApi.get(`/users/${GITHUB_USERNAME}/repos`, {
      params: {
        page,
        per_page,
        sort,
        direction,
        type
      }
    });

    // Get total count from headers
    const linkHeader = response.headers.link;
    let total = response.data.length;
    
    if (linkHeader) {
      const lastMatch = linkHeader.match(/page=(\d+)>; rel="last"/);
      if (lastMatch) {
        total = parseInt(lastMatch[1]) * per_page;
      }
    }

    const result = {
      repos: response.data,
      pagination: {
        page,
        per_page,
        total
      }
    };

    setCacheData(cacheKey, result);

    res.json(result);
  } catch (error) {
    console.error('GitHub API error:', error);
    next(createError('Failed to fetch repositories', 500));
  }
});

/**
 * @swagger
 * /api/github/repos/{owner}/{repo}:
 *   get:
 *     summary: Get specific repository details
 *     tags: [GitHub]
 *     parameters:
 *       - in: path
 *         name: owner
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: repo
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Repository details retrieved successfully
 *       404:
 *         description: Repository not found
 *       500:
 *         description: Failed to fetch repository
 */
router.get('/repos/:owner/:repo', rateLimiter.api, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { owner, repo } = req.params;
    
    const cacheKey = `repo:${owner}:${repo}`;
    const cachedData = getCachedData(cacheKey);
    
    if (cachedData) {
      return res.json(cachedData);
    }

    const response = await githubApi.get(`/repos/${owner}/${repo}`);
    
    setCacheData(cacheKey, response.data);

    res.json(response.data);
  } catch (error: any) {
    if (error.response?.status === 404) {
      next(createError('Repository not found', 404));
    } else {
      console.error('GitHub API error:', error);
      next(createError('Failed to fetch repository', 500));
    }
  }
});

/**
 * @swagger
 * /api/github/languages:
 *   get:
 *     summary: Get programming language statistics
 *     tags: [GitHub]
 *     responses:
 *       200:
 *         description: Language statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 languages:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                       bytes:
 *                         type: integer
 *                       percentage:
 *                         type: number
 *                       color:
 *                         type: string
 *                 totalBytes:
 *                   type: integer
 *       500:
 *         description: Failed to fetch language statistics
 */
router.get('/languages', rateLimiter.api, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cacheKey = `languages:${GITHUB_USERNAME}`;
    const cachedData = getCachedData(cacheKey);
    
    if (cachedData) {
      return res.json(cachedData);
    }

    // Fetch all repositories
    const reposResponse = await githubApi.get(`/users/${GITHUB_USERNAME}/repos`, {
      params: {
        per_page: 100,
        type: 'owner'
      }
    });

    // Fetch languages for each repo
    const languagePromises = reposResponse.data.map((repo: any) => 
      githubApi.get(`/repos/${GITHUB_USERNAME}/${repo.name}/languages`)
        .then(res => res.data)
        .catch(() => ({}))
    );

    const languagesData = await Promise.all(languagePromises);

    // Aggregate language statistics
    const aggregated: Record<string, number> = {};
    let totalBytes = 0;

    languagesData.forEach(repoLangs => {
      Object.entries(repoLangs).forEach(([lang, bytes]) => {
        aggregated[lang] = (aggregated[lang] || 0) + (bytes as number);
        totalBytes += bytes as number;
      });
    });

    // Sort by bytes and calculate percentages
    const languages = Object.entries(aggregated)
      .sort(([, a], [, b]) => b - a)
      .map(([name, bytes]) => ({
        name,
        bytes,
        percentage: parseFloat(((bytes / totalBytes) * 100).toFixed(2)),
        color: getLanguageColor(name)
      }));

    const result = {
      languages,
      totalBytes
    };

    setCacheData(cacheKey, result);

    res.json(result);
  } catch (error) {
    console.error('GitHub API error:', error);
    next(createError('Failed to fetch language statistics', 500));
  }
});

/**
 * @swagger
 * /api/github/contributions:
 *   get:
 *     summary: Get contribution statistics
 *     tags: [GitHub]
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 365
 *           default: 30
 *     responses:
 *       200:
 *         description: Contribution statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalContributions:
 *                   type: integer
 *                 totalCommits:
 *                   type: integer
 *                 totalPRs:
 *                   type: integer
 *                 totalIssues:
 *                   type: integer
 *                 totalReviews:
 *                   type: integer
 *                 contributionsByRepo:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       repo:
 *                         type: string
 *                       commits:
 *                         type: integer
 *       500:
 *         description: Failed to fetch contributions
 */
router.get('/contributions', rateLimiter.api, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const days = Math.min(parseInt(req.query.days as string) || 30, 365);
    const since = new Date();
    since.setDate(since.getDate() - days);

    const cacheKey = `contributions:${GITHUB_USERNAME}:${days}`;
    const cachedData = getCachedData(cacheKey);
    
    if (cachedData) {
      return res.json(cachedData);
    }

    // Fetch events (limited to recent activity)
    const eventsResponse = await githubApi.get(`/users/${GITHUB_USERNAME}/events/public`, {
      params: { per_page: 100 }
    });

    const events = eventsResponse.data;
    
    // Calculate statistics
    let totalCommits = 0;
    let totalPRs = 0;
    let totalIssues = 0;
    let totalReviews = 0;
    const contributionsByRepo: Record<string, number> = {};

    events.forEach((event: any) => {
      const eventDate = new Date(event.created_at);
      if (eventDate < since) return;

      switch (event.type) {
        case 'PushEvent':
          totalCommits += event.payload.commits?.length || 0;
          contributionsByRepo[event.repo.name] = (contributionsByRepo[event.repo.name] || 0) + (event.payload.commits?.length || 0);
          break;
        case 'PullRequestEvent':
          totalPRs++;
          break;
        case 'IssuesEvent':
          totalIssues++;
          break;
        case 'PullRequestReviewEvent':
          totalReviews++;
          break;
      }
    });

    const result = {
      totalContributions: totalCommits + totalPRs + totalIssues + totalReviews,
      totalCommits,
      totalPRs,
      totalIssues,
      totalReviews,
      contributionsByRepo: Object.entries(contributionsByRepo)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([repo, commits]) => ({ repo, commits }))
    };

    setCacheData(cacheKey, result);

    res.json(result);
  } catch (error) {
    console.error('GitHub API error:', error);
    next(createError('Failed to fetch contributions', 500));
  }
});

/**
 * @swagger
 * /api/github/pinned:
 *   get:
 *     summary: Get pinned repositories
 *     tags: [GitHub]
 *     responses:
 *       200:
 *         description: Pinned repositories retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 repos:
 *                   type: array
 *                   items:
 *                     type: object
 *       500:
 *         description: Failed to fetch pinned repositories
 */
router.get('/pinned', rateLimiter.api, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cacheKey = `pinned:${GITHUB_USERNAME}`;
    const cachedData = getCachedData(cacheKey);
    
    if (cachedData) {
      return res.json(cachedData);
    }

    // GitHub doesn't have a direct API for pinned repos
    // We'll fetch all repos and filter by a "pinned" topic or return featured ones
    const response = await githubApi.get(`/users/${GITHUB_USERNAME}/repos`, {
      params: {
        sort: 'updated',
        per_page: 100
      }
    });

    // Filter repos that have topics including "pinned" or "featured"
    // Or return top 6 most starred repos
    let pinnedRepos = response.data.filter((repo: any) => 
      repo.topics?.includes('pinned') || repo.topics?.includes('featured')
    );

    if (pinnedRepos.length === 0) {
      // Return top 6 most starred repos
      pinnedRepos = response.data
        .sort((a: any, b: any) => b.stargazers_count - a.stargazers_count)
        .slice(0, 6);
    }

    const result = { repos: pinnedRepos };

    setCacheData(cacheKey, result);

    res.json(result);
  } catch (error) {
    console.error('GitHub API error:', error);
    next(createError('Failed to fetch pinned repositories', 500));
  }
});

// Helper function to get language colors (common languages)
function getLanguageColor(language: string): string {
  const colors: Record<string, string> = {
    JavaScript: '#f1e05a',
    TypeScript: '#2b7489',
    Python: '#3572A5',
    Java: '#b07219',
    'C++': '#f34b7d',
    C: '#555555',
    Go: '#00ADD8',
    Rust: '#dea584',
    Ruby: '#701516',
    PHP: '#4F5D95',
    Swift: '#ffac45',
    Kotlin: '#F18E33',
    Dart: '#00B4AB',
    HTML: '#e34c26',
    CSS: '#563d7c',
    Shell: '#89e051',
    Dockerfile: '#384d54'
  };
  
  return colors[language] || '#586069';
}

export default router;