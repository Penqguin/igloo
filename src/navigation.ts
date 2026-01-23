// Navigation types and data
export interface NavLink {
  logo?: string;
  text: string;
  href: string;
}

export interface ContentLink extends NavLink {
  logo: string;
  text: string;
  href: string;
}
export interface logo {
  logo: boolean;
}

export interface HeaderData {
  links: NavLink[];
}

export interface FooterData {
  contentLinks: ContentLink[];
}

export const headerData: HeaderData = {
  links: [
    { logo: 'mdi:home', text: 'Home', href: '/' },
    { text: 'About', href: '/about' },
    { text: 'Projects', href: '/projects' },
    { text: 'Snowboarding', href: '/snowboarding' },
    { text: 'Resume', href: '/resume' },
  ],
};

export const footerData: FooterData = {
  contentLinks: [
    {
      logo: 'mdi:github',
      text: 'GitHub',
      href: 'https://github.com/penqguin',
    },
    {
      logo: 'mdi:linkedin',
      text: 'LinkedIn',
      href: 'https://www.linkedin.com/in/michaelpanmaddison/',
    },
  ],
};

export interface Project {
  name: string;
  title: string;
  description: string;
  featured: boolean;
  github: string;
  tags: string[];
}

export const projects: Project[] = [
  {
    name: 'igloo',
    title: 'Igloo',
    description:
      'A modern Astro-based static site generator portfolio with TypeScript, Tailwind CSS, and responsive design.',
    featured: true,
    github: 'https://github.com/Penqguin/igloo',
    tags: ['astro', 'typescript', 'tailwind', 'web'],
  },
  {
    name: 'PengWM',
    title: 'PengWM',
    description: 'A lightweight window manager built with performance and simplicity in mind.',
    featured: true,
    github: 'https://github.com/Penqguin/PengWM',
    tags: ['window-manager', 'systems', 'C'],
  },
  {
    name: 'Computing-Competitions',
    title: 'Computing Competitions',
    description:
      'Solutions and resources for competitive programming challenges and algorithmic problem-solving.',
    featured: false,
    github: 'https://github.com/Penqguin/Computing-Competitions',
    tags: ['algorithms', 'competitive-programming', 'python', 'C++'],
  },
];
