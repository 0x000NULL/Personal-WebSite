import { 
  Resolver, 
  Query, 
  Arg, 
  Ctx, 
  Int
} from 'type-graphql';
import { 
  GitHubActivity, 
  Repository, 
  RepositoryConnection,
  GitHubProfile,
  LanguageStats,
  ContributionStats
} from '../types/Repository';
import { PaginationInput } from '../inputs/PaginationInput';
import { Context } from '../context';
import axios from 'axios';

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

@Resolver(() => GitHubActivity)
export class GitHubResolver {
  @Query(() => GitHubActivity)
  async githubActivity(
    @Arg('days', () => Int, { defaultValue: 30 }) days: number,
    @Ctx() ctx?: Context
  ): Promise<GitHubActivity> {
    const cacheKey = `github-activity:${days}`;
    const cachedData = getCachedData(cacheKey);
    
    if (cachedData) {
      return cachedData;
    }

    try {
      // Fetch profile
      const profileResponse = await githubApi.get(`/users/${GITHUB_USERNAME}`);
      const profile = this.mapToGitHubProfile(profileResponse.data);

      // Fetch repositories
      const reposResponse = await githubApi.get(`/users/${GITHUB_USERNAME}/repos`, {
        params: {
          sort: 'updated',
          per_page: 100,
          type: 'owner'
        }
      });
      const repositories = reposResponse.data.map((repo: any) => this.mapToRepository(repo));

      // Fetch pinned repositories
      const pinnedRepos = repositories
        .filter((repo: any) => repo.topics?.includes('pinned') || repo.topics?.includes('featured'))
        .slice(0, 6);
      
      const pinnedRepositories = pinnedRepos.length > 0 ? pinnedRepos : 
        repositories
          .sort((a: any, b: any) => b.stargazersCount - a.stargazersCount)
          .slice(0, 6);

      // Fetch language statistics
      const languageStats = await this.getLanguageStats();

      // Fetch contribution statistics
      const contributionStats = await this.getContributionStats(days);

      // Calculate total bytes
      const totalBytes = languageStats.reduce((sum, lang) => sum + lang.bytes, 0);

      const result = {
        profile,
        repositories,
        pinnedRepositories,
        languageStats,
        contributionStats,
        totalBytes
      };

      setCacheData(cacheKey, result);
      return result;
    } catch (error) {
      console.error('GitHub API error:', error);
      throw new Error('Failed to fetch GitHub activity');
    }
  }

  @Query(() => RepositoryConnection)
  async repositories(
    @Arg('pagination', () => PaginationInput, { nullable: true }) pagination?: PaginationInput,
    @Arg('sort', { defaultValue: 'updated' }) sort?: string,
    @Arg('direction', { defaultValue: 'desc' }) direction?: string,
    @Ctx() ctx?: Context
  ): Promise<RepositoryConnection> {
    const page = pagination?.page || 1;
    const limit = Math.min(pagination?.limit || 30, 100);

    const cacheKey = `repos:${page}:${limit}:${sort}:${direction}`;
    const cachedData = getCachedData(cacheKey);
    
    if (cachedData) {
      return cachedData;
    }

    try {
      const response = await githubApi.get(`/users/${GITHUB_USERNAME}/repos`, {
        params: {
          page,
          per_page: limit,
          sort,
          direction,
          type: 'owner'
        }
      });

      const repositories = response.data.map((repo: any) => this.mapToRepository(repo));

      // Get total count from headers
      const linkHeader = response.headers.link;
      let total = repositories.length;
      
      if (linkHeader) {
        const lastMatch = linkHeader.match(/page=(\d+)>; rel="last"/);
        if (lastMatch) {
          total = parseInt(lastMatch[1]) * limit;
        }
      }

      const result = {
        repositories,
        total,
        page,
        limit,
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1
      };

      setCacheData(cacheKey, result);
      return result;
    } catch (error) {
      console.error('GitHub API error:', error);
      throw new Error('Failed to fetch repositories');
    }
  }

  @Query(() => Repository, { nullable: true })
  async repository(
    @Arg('owner') owner: string,
    @Arg('name') name: string,
    @Ctx() ctx?: Context
  ): Promise<Repository | null> {
    const cacheKey = `repo:${owner}:${name}`;
    const cachedData = getCachedData(cacheKey);
    
    if (cachedData) {
      return cachedData;
    }

    try {
      const response = await githubApi.get(`/repos/${owner}/${name}`);
      const repository = this.mapToRepository(response.data);

      setCacheData(cacheKey, repository);
      return repository;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      console.error('GitHub API error:', error);
      throw new Error('Failed to fetch repository');
    }
  }

  private async getLanguageStats(): Promise<LanguageStats[]> {
    try {
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
      return Object.entries(aggregated)
        .sort(([, a], [, b]) => b - a)
        .map(([name, bytes]) => ({
          name,
          bytes,
          percentage: parseFloat(((bytes / totalBytes) * 100).toFixed(2)),
          color: this.getLanguageColor(name)
        }));
    } catch (error) {
      console.error('Language stats error:', error);
      return [];
    }
  }

  private async getContributionStats(days: number): Promise<ContributionStats> {
    try {
      const since = new Date();
      since.setDate(since.getDate() - days);

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

      return {
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
    } catch (error) {
      console.error('Contribution stats error:', error);
      return {
        totalContributions: 0,
        totalCommits: 0,
        totalPRs: 0,
        totalIssues: 0,
        totalReviews: 0,
        contributionsByRepo: []
      };
    }
  }

  private mapToGitHubProfile(data: any): GitHubProfile {
    return {
      id: data.id,
      login: data.login,
      name: data.name,
      avatarUrl: data.avatar_url,
      bio: data.bio,
      company: data.company,
      location: data.location,
      email: data.email,
      blog: data.blog,
      twitterUsername: data.twitter_username,
      publicRepos: data.public_repos,
      publicGists: data.public_gists,
      followers: data.followers,
      following: data.following,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }

  private mapToRepository(data: any): Repository {
    return {
      id: data.id,
      name: data.name,
      fullName: data.full_name,
      description: data.description,
      htmlUrl: data.html_url,
      language: data.language,
      stargazersCount: data.stargazers_count,
      forksCount: data.forks_count,
      watchersCount: data.watchers_count,
      size: data.size,
      isPrivate: data.private,
      isFork: data.fork,
      isArchived: data.archived,
      isDisabled: data.disabled,
      topics: data.topics || [],
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      pushedAt: new Date(data.pushed_at),
      homepage: data.homepage,
      license: data.license?.name,
      defaultBranch: data.default_branch,
      openIssues: data.open_issues_count,
      hasIssues: data.has_issues,
      hasProjects: data.has_projects,
      hasWiki: data.has_wiki,
      hasPages: data.has_pages,
      hasDownloads: data.has_downloads
    };
  }

  private getLanguageColor(language: string): string {
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
}