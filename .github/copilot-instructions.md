# Copilot Instructions for Igloo Project

This is an Astro-based static site generator project using TypeScript, Tailwind CSS, and pnpm for package management.

## Project Architecture

**Framework**: Astro 5.x - A modern static site builder with zero-JS-by-default architecture

- **Entry Point**: `src/pages/` - File-based routing system (each `.astro` file becomes a route)
- **Components**: `src/components/` - Reusable Astro components (.astro files)
- **Styling**: Tailwind CSS 4 with `@tailwindcss/vite` integration
- **Utilities**: `src/utils/` - Shared TypeScript/JavaScript helper functions
- **Assets**: `src/assets/` - Static images, fonts, and other resources
- **Config**: `astro.config.mjs` (minimal) + `tsconfig.json` (extends astro/base)

## Development Workflow

### Core Commands

- `pnpm dev` - Start local dev server (hot reload enabled)
- `pnpm build` - Production build (outputs to `dist/`)
- `pnpm preview` - Preview production build locally

### Package Manager

- **pnpm 10.24.0** is required (enforced by `packageManager` field in package.json)
- Use `pnpm add/remove` for dependencies, never `npm`
- Workspace is configured in `pnpm-workspace.yaml` for monorepo support

## Key Patterns & Conventions

### Astro Components

- Files in `src/pages/*.astro` automatically create routes
- Use `.astro` format for server-side rendered pages/components
- Frontmatter (---) separates component logic from template
- No hydration by default - add `client:` directives only when needed

### Styling

- Tailwind CSS 4 is configured via `@tailwindcss/vite` (builds with Vite)
- Apply utility classes directly in HTML templates
- Custom CSS goes in `<style>` blocks within `.astro` files

### TypeScript

- `tsconfig.json` extends `astro/tsconfigs/base` - trust Astro defaults
- Use strict TypeScript settings inherited from Astro config
- Import types with `import type` for client-side components

## Before Making Changes

1. **Check the structure first** - Understand where files belong (pages vs components vs utils)
2. **Respect Astro conventions** - Don't add unnecessary JavaScript hydration
3. **Use pnpm** - All package operations require pnpm, not npm
4. **Consider static-first** - This project defaults to static HTML (no client JS unless explicitly needed)

## Common Tasks

- **Add a new page**: Create `.astro` file in `src/pages/`
- **Add a reusable component**: Create `.astro` file in `src/components/`
- **Add utilities**: Export functions from `src/utils/`
- **Install dependency**: `pnpm add package-name`
- **Check types**: TypeScript checking is automatic in IDE
