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
    { text: 'Photos', href: '/photos' },
    { text: 'Notes', href: 'https://notes.penqguin.com' },
    // { text: 'Resume', href: '/resume' },
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
  image: string;
  date: string;
  featured: boolean;
  github: string;
  tags: string[];
  readme?: string; // Optional custom README URL or path
}

export const projects: Project[] = [
  {
    name: 'igloo',
    title: 'Igloo',
    description:
      'A modern Astro-based static site generator portfolio with TypeScript, Tailwind CSS, and responsive design.',
    image: '/project-thumbnails/igloo.jpg',
    date: '2025',
    featured: true,
    github: 'https://github.com/Penqguin/igloo',
    tags: ['astro', 'typescript', 'tailwind', 'web'],
    readme: 'https://raw.githubusercontent.com/Penqguin/igloo/main/README.md',
  },
  {
    name: 'PengWM',
    title: 'PengWM',
    description: 'A lightweight window manager built with performance and simplicity in mind.',
    image: '/project-thumbnails/PengWM.jpg',
    date: '2025',
    featured: true,
    github: 'https://github.com/Penqguin/PengWM',
    tags: ['window-manager', 'systems', 'Rust'],
    readme: 'https://raw.githubusercontent.com/Penqguin/PengWM/master/README.md',
  },
  {
    name: 'ONotes',
    title: 'ONotes',
    description:
      'My personal notes for classes and projects.',
    image: '/project-thumbnails/ONotes.jpg',
    date: '2025',
    featured: false,
    github: 'https://github.com/Penqguin/ONotes',
    tags: ['algorithms', 'data-structures', 'notes', 'Quartz v4'],
    readme: 'https://raw.githubusercontent.com/Penqguin/ONotes/main/README.md',
  },
];
