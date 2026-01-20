# Fumadocs Setup & Documentation Migration Tasks

## Overview
This document outlines the tasks required to set up Fumadocs documentation for the Zagora library and convert the existing README.md content into a structured documentation site.

## Phase 1: Fumadocs Setup

### 1.1 Project Structure Setup
- [x] Create `apps/docs/` directory with proper structure
- [x] Initialize Next.js project with TypeScript in `apps/docs/`
- [x] Configure Fumadocs packages and dependencies
- [x] Add `apps/docs` to bun workspaces in root `package.json`
- [x] Set up Tailwind CSS and shadcn/ui components

### 1.2 Fumadocs Configuration
- [ ] Create `apps/docs/fumadocs.config.ts` with basic configuration
- [ ] Set up MDX configuration with syntax highlighting (Shiki)
- [ ] Configure content source and file structure
- [ ] Set up navigation structure
- [ ] Configure theme and layout components

### 1.3 Development Environment
- [ ] Add development scripts to `apps/docs/package.json`
- [ ] Configure build scripts for production deployment
- [ ] Set up linting and formatting (Biome)
- [ ] Test local development server setup

## Phase 2: Content Conversion

### 2.1 Front Page Design
- [ ] Create homepage with hero section
- [ ] Design highlights section with card components (11 highlights from README)
- [ ] Add features overview section
- [ ] Create comparison tables (3 separate tables):
  - Zagora vs oRPC/tRPC/neverthrow/effect.ts
  - Zagora vs Plain TypeScript
  - Zagora vs Standalone Zod/Valibot
- [ ] Add quick navigation links to main sections

### 2.2 Documentation Pages
- [ ] **Getting Started** - Convert installation and basic usage sections
- [ ] **Why Zagora?** - Motivation and comparison content
- [ ] **Features** - Break down into individual pages:
  - Type-Safe Input/Output Validation
  - Typed Errors & Error Type Guards
  - Context Management
  - Object Inputs & Tuple Inputs
  - Default Values & Async Support
  - Caching/Memoization & Environment Variables
  - Handler Options & Auto-Callable Mode
  - Never-Throwing & Type Safety Guarantees
- [ ] **API Reference** - Complete API documentation
- [ ] **Error Types & ZagoraResult** - Type system documentation
- [ ] **Migration Guide** - Not applicable (new library)

### 2.3 Content Enhancement
- [ ] Add interactive code examples with copy buttons
- [ ] Convert code blocks to use Fumadocs features (tabs, callouts)
- [ ] Add cross-references between related pages
- [ ] Include table of contents for long pages
- [ ] Add search functionality setup

## Phase 3: Advanced Features

### 3.1 Search Integration
- [ ] Configure Algolia search or Orama search
- [ ] Set up search index and configuration
- [ ] Add search UI components 
  
## Technical Requirements

### Dependencies
- Next.js 14+ (App Router) / TanStack Start (SPA)
- fumadocs-core, fumadocs-ui, fumadocs-mdx
- Tailwind CSS + shadcn/ui
- TypeScript
- Required: bun as package manager

### Content Structure
```
apps/docs/
├── app/                    # Next.js app directory
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Homepage
│   └── docs/              # Documentation pages
├── content/               # MDX content files
├── components/            # Custom components
├── lib/                   # Utility functions
└── fumadocs.config.ts     # Fumadocs configuration
```

### Key Conversions Needed
1. README highlights → Frontpage cards with icons
2. "Why Zagora?" sections → Comparison tables
3. Feature examples → Interactive documentation
4. API reference → Structured reference docs
5. Code examples → Fumadocs-enhanced code blocks

## Success Criteria
- [ ] All README content successfully migrated
- [ ] Frontpage highlights displayed as attractive cards
- [ ] Comparison tables clearly present advantages
- [ ] All links and navigation working
- [ ] Search functionality operational
- [ ] Fast loading and responsive design
- [ ] Easy to maintain and update documentation structure
