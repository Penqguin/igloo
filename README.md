# My Portfolio Website

Built with [Astro](https://astro.build) and [Tailwind CSS](https://tailwindcss.com).

## 📁 Project Structure

```
/
├── public/                      # Static assets
│   ├── robots.txt              # SEO robots config
│   └── favicon.svg             # Site favicon
├── src/
│   ├── assets/
│   │   ├── favicons/           # Various favicon formats
│   │   ├── images/             # Project images and photos
│   │   └── styles/
│   │       └── tailwind.css    # Tailwind CSS imports
│   ├── components/
│   │   ├── common/             # Shared layout components
│   │   ├── ui/                 # Reusable UI components
│   │   ├── widgets/            # Page sections (Header, Footer, Hero)
│   │   ├── portfolio/          # Portfolio-specific components
│   │   ├── Favicons.astro      # Favicon meta tags
│   ├── content/
│   │   └── portfolio/          # Portfolio item markdown files
│   ├── layouts/
│   │   └── Layout.astro        # Main page layout
│   ├── pages/
│   │   ├── index.astro         # Homepage
│   │   ├── about.astro         # About page
│   │   ├── portfolio.astro     # Portfolio page
│   │   ├── services.astro      # Services page
│   │   ├── contact.astro       # Contact page
│   │   └── 404.astro           # Error page
│   ├── config.yaml             # Site configuration
│   └── navigation.js           # Navigation and menu data
├── .prettierrc                 # Code formatting config
├── tailwind.config.js          # Tailwind CSS config
├── tsconfig.json               # TypeScript config
├── astro.config.mjs            # Astro configuration
└── package.json                # Dependencies
