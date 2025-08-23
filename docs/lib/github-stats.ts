interface GitHubStats {
  stars: number;
  forks: number;
  watchers: number;
  openIssues: number;
  language: string;
  description: string;
  updatedAt: string;
}

let cachedStats: GitHubStats | null = null;
let lastFetch = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function fetchGitHubStats(): Promise<GitHubStats> {
  const now = Date.now();
  
  if (cachedStats && (now - lastFetch) < CACHE_DURATION) {
    return cachedStats;
  }
  
  try {
    const response = await fetch('https://api.github.com/repos/ronin-co/blade', {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'blade-docs'
      }
    });
    
    if (!response.ok) {
      throw new Error(`GitHub API responded with status: ${response.status}`);
    }
    
    const data = await response.json();
    
    const stats: GitHubStats = {
      stars: data.stargazers_count,
      forks: data.forks_count,
      watchers: data.watchers_count,
      openIssues: data.open_issues_count,
      language: data.language,
      description: data.description,
      updatedAt: data.updated_at
    };
    
    cachedStats = stats;
    lastFetch = now;
    
    return stats;
  } catch (error) {
    console.error('Error fetching GitHub stats:', error);
    
    if (cachedStats) {
      return cachedStats;
    }
    
    return {
      stars: 0,
      forks: 0,
      watchers: 0,
      openIssues: 0,
      language: '',
      description: '',
      updatedAt: new Date().toISOString()
    };
  }
}
