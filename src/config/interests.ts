/** Semantic groupings of catalog tags presented during onboarding and interest selection. */
export interface InterestGroup {
  label: string;
  icon: string;
  tags: string[];
}

export const INTEREST_GROUPS: InterestGroup[] = [
  { label: 'News & World', icon: '🌍', tags: ['news', 'world', 'politics', 'explainer'] },
  {
    label: 'Technology',
    icon: '💻',
    tags: [
      'technology',
      'tech',
      'gadgets',
      'hardware',
      'google',
      'apple',
      'android',
      'browsers',
      'microsoft',
      'windows',
      'linux',
      'enterprise',
    ],
  },
  {
    label: 'Programming',
    icon: '👨‍💻',
    tags: [
      'programming',
      'javascript',
      'frontend',
      'devtools',
      'react',
      'css',
      'python',
      'go',
      'rust',
      'opensource',
      'devops',
      'infrastructure',
      'cloud',
      'containers',
      'database',
      'software',
      'systems',
    ],
  },
  { label: 'AI & Future', icon: '🤖', tags: ['ai', 'future', 'innovation'] },
  { label: 'Science & Space', icon: '🔬', tags: ['science', 'space', 'physics', 'math', 'medicine', 'engineering'] },
  {
    label: 'Security & Privacy',
    icon: '🔒',
    tags: ['security', 'privacy', 'hacking', 'cybercrime', 'breaches', 'civil-liberties'],
  },
  { label: 'Business & Finance', icon: '📈', tags: ['business', 'finance', 'startups', 'economics', 'budget'] },
  { label: 'Design & Architecture', icon: '🎨', tags: ['design', 'architecture', 'interiors', 'art'] },
  { label: 'Culture & Entertainment', icon: '🎭', tags: ['culture', 'entertainment', 'movies', 'music', 'tv', 'arts'] },
  { label: 'Food & Cooking', icon: '🍳', tags: ['food', 'cooking'] },
  { label: 'Books & Ideas', icon: '📚', tags: ['books', 'literature', 'philosophy', 'ideas', 'essays', 'longform'] },
  { label: 'History & Curiosities', icon: '🏛️', tags: ['history', 'curiosities', 'trivia', 'stories'] },
  { label: 'Health & Fitness', icon: '💪', tags: ['health', 'fitness', 'running', 'wellness', 'men'] },
  { label: 'Travel & Lifestyle', icon: '✈️', tags: ['travel', 'lifestyle'] },
  { label: 'Gaming & Maker', icon: '🎮', tags: ['gaming', 'pc', 'maker', 'diy', 'electronics'] },
  { label: 'Humor & Fun', icon: '😄', tags: ['humor', 'satire', 'fun'] },
  { label: 'Sports', icon: '⚽', tags: ['sports'] },
  { label: 'Web & Browsers', icon: '🌐', tags: ['web', 'performance', 'browsers'] },
];
