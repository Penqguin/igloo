# My Portfolio Website

A modern, responsive portfolio website built with [Astro](https://astro.build) and [Tailwind CSS](https://tailwindcss.com).

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
│   │   └── Logo.astro          # Logo component
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

```

## 🚀 Getting Started

### Prerequisites

- Node.js 16+
- pnpm (or npm/yarn)

### Installation

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview
```

## 📝 Customization

### Update Site Info

Edit `src/config.yaml` with your details:

- Site name and URL
- Meta descriptions and OG images
- Social media handles

### Update Navigation

Edit `src/navigation.js` to customize:

- Header links
- Footer links

### Add Portfolio Items

Create new files in `src/components/portfolio/` or add content to `src/content/portfolio/`

### Customize Colors & Typography

- Edit `tailwind.config.js` for Tailwind settings
- Update `src/assets/styles/tailwind.css` for custom CSS
- Modify component classes for design changes

## 🎨 Components

- **Header.astro** - Navigation and branding
- **Hero.astro** - Full-screen hero section
- **ProjectCard.astro** - Portfolio item card
- **Footer.astro** - Footer with links

## 🌙 Dark Mode

The site includes automatic dark mode support via Tailwind's `dark:` utilities. Users can toggle based on system preference or manually.

## 📱 Responsive Design

Built with mobile-first responsive design using Tailwind breakpoints:

- `sm` - 640px
- `md` - 768px
- `lg` - 1024px
- `xl` - 1280px

## 🔍 SEO

- Meta tags in `Favicons.astro`
- Open Graph support in `config.yaml`
- Sitemap auto-generation
- robots.txt for crawlers

## 📦 Dependencies

- **astro** ^5.16.4
- **tailwindcss** ^4.1.17
- **@tailwindcss/vite** ^4.1.17

## 🚢 Deployment

Ready to deploy to:

- Netlify
- Vercel
- GitHub Pages
- Any static hosting

Build output goes to `dist/` directory.

## 📄 License

ISC License - feel free to use this template for your portfolio!

## 🤝 Contributing

Feel free to customize and make this portfolio your own!
