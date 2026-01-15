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
    { text: 'Home', href: '/' },
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
