# Zagora Documentation Site Plan

## Overview

Build a professional documentation site for Zagora using Vocs (React/Vite-based static docs generator) in the `apps/docs` workspace. The site should follow the professional, developer-oriented style of oRPC/viem docs while highlighting Zagora's unique value propositions.

## Theme & Branding

- **Accent Color**: Orange/Amber (`#f97316` or similar warm orange)
- **Logo**: Text-only "Zagora" for now (can add logo later)
- **Font**: Inter (default Vocs font) or similar modern sans-serif
- **Color Scheme**: System-aware (dark/light mode support)

---

## Homepage Design

### Hero Section

**Heading**: `Zagora`

**Tagline** (3 sentences max):
> Build type-safe, error-safe functions that never throw. Full TypeScript inference with tuple arguments, sync/async awareness, and typed error handling. Just pure functions—no routers, no network layer, no unwrapping.

**Subtitle/Description**:
> The robust alternative to oRPC and tRPC for building libraries. Powered by StandardSchema validators like Zod, Valibot, and ArkType.

**CTA Buttons**:
1. "Get Started" (primary, links to /docs/getting-started)
2. "GitHub" (secondary, links to repo)

**Hero Code Example** (with working syntax highlighting):
```ts
import { z } from 'zod';
import { zagora } from 'zagora';

const getUser = zagora()
  .input(z.tuple([z.string(), z.number().default(18), z.string().optional()]))
  .handler((_, name, age, country) => {
    // name: string
    // age: number <-- because there is a default value in schema!
    // country: string | undefined <-- because it's marked as optional in schema!
    return `${name} is ${age}, from ${country || 'unknown'}`
  })

getUser('John', 30);
// => John is 30

// @ts-expect-error -- reported at compile-time AND runtime, invalid second argument
getUser('John', 'foo');

// @ts-expect-error -- reported at compile-time AND runtime, missing required second argument
getUser('John');

// NOTE: fine, because second and third arguments are optional
getUser('Barry') // => Barry is 18, from unknown

getUser('Barry', 25) // => Barry is 25, from unknown
getUser('Barry', 33, 'USA') // => Barry is 33, from USA

const result = await getUser('Alice');
if (result.ok) {
  console.log(result.data); // { name: 'Alice', age: 18 }
} else {
  console.error(result.error.kind);
  
  console.error(result.error);
  // ^ { kind: 'UNKNOWN_ERROR', message, cause }
  // or
  // ^ { kind: 'VALIDATION_ERROR', message, issues: Schema.Issue[] }
}
```

### Feature Cards Section

Each card should have:
- Icon/Emoji
- Title (2-4 words)
- Description (3 sentences explaining the feature, benefits, and why it matters)

**Feature Cards** (rephrased from README highlights):

1. **Minimal & Standards-Based**
   Zagora is lightweight with zero bloat, built entirely on StandardSchema for universal validation. This means you can use Zod, Valibot, ArkType, or any compliant validator. No lock-in, just the tools you already know and love.

2. **Never-Throwing Execution**
   Every function returns a predictable `{ ok, data, error }` result—exceptions are eliminated completely. Your process never crashes from unhandled errors, similar to Effect.ts or neverthrow. This gives you total control and deterministic error handling across your entire codebase.

3. **Typed Error System**
   Define error schemas upfront and get strongly-typed error helpers inside your handlers. Each error kind is validated at runtime and fully typed at compile-time. You'll never see `try/catch` blocks or guess error shapes again.

4. **Full Type Inference**
   Complete TypeScript inference across inputs, outputs, errors, context, defaults, and optionals. Even JavaScript consumers get full autocomplete and IntelliSense support. The type system has been battle-tested with dedicated type-level tests.

5. **Tuple Arguments Support**
   Define multiple function arguments using schema tuples with per-argument validation and defaults. Call your functions naturally like `fn('Alice', 25)` instead of `fn({ name: 'Alice', age: 25 })`. This creates a familiar API that feels like native TypeScript functions.

6. **Sync & Async Awareness**
   Zagora dynamically infers whether procedures are sync or async based on handler and schema behavior. Sync handlers return `Result`, async handlers return `Promise<Result>`—no forced async everywhere. This is impossible with oRPC/tRPC where everything is always async.

7. **Built-in Caching**
   Add memoization to any procedure with a simple cache adapter. Cache keys include input, schemas, and handler body for intelligent invalidation. Works with both sync and async cache implementations seamlessly.

8. **Just Pure Functions**
   Zagora produces regular TypeScript functions—no special clients, routers, or network glue required. Export your procedures directly and call them like any other function. Perfect for building type-safe libraries, SDKs, and internal tooling.

9. **Env Vars Validation**
   Validate environment variables with the same schema system used for inputs and outputs. Get type-safe access to `process.env` or `import.meta.env` inside handlers. Coercion, defaults, and optionals work exactly as expected.

10. **No Unwrapping Required**
    Unlike neverthrow or similar libraries, you directly access `result.data` or `result.error`. No `.unwrap()`, `.map()`, or monadic chains needed. The discriminated union type guides you naturally with TypeScript's narrowing.

### Comparison Tables Section

#### Table 1: Zagora vs RPC Frameworks (oRPC/tRPC)

| Feature | Zagora | oRPC | tRPC |
|---------|--------|------|------|
| Sync procedure support | Yes (dynamic inference) | No (always async) | No (always async) |
| Tuple/multiple arguments | Yes (`z.tuple([...])`) | No (single object) | No (single object) |
| Network layer required | No | Yes | Yes |
| Router concept built-in | No (DIY if needed) | Yes | Yes |
| Middleware system | No (external) | Yes | Yes |
| Typed errors with schemas | Yes | Partial | Partial |
| Error validation | Yes (validates error payloads) | No | No |
| StandardSchema support | Yes | Yes | Partial |
| Bundle size focus | Minimal | Moderate | Moderate |
| Primary use case | Libraries & functions | APIs & backends | APIs & backends |

**Philosophy**: Zagora focuses on building low-level, composable functions for libraries. oRPC and tRPC are designed for API endpoints with network communication. Choose Zagora when you need type-safe functions without the network overhead.

#### Table 2: Zagora vs Functional Libraries (neverthrow/Effect.ts)

| Feature | Zagora | neverthrow | Effect.ts |
|---------|--------|------------|-----------|
| Result unwrapping | Not needed | Required (`.unwrap()`) | Complex API |
| Learning curve | Minimal | Low | Very steep |
| Validation included | Yes (StandardSchema) | No | Yes (own system) |
| Error schema support | Yes (typed helpers) | No | Yes (different approach) |
| Functional programming focus | No | Yes | Yes (heavy FP) |
| Type inference | Full | Good | Excellent |
| Bundle size | Tiny | Small | Large |
| Primary philosophy | Practical type-safety | Monadic errors | Full effect system |

**Philosophy**: Zagora gives you error-safe results without functional programming overhead. neverthrow requires monadic operations, Effect.ts requires learning an entirely new paradigm. Zagora is "just functions" with predictable results.

#### Table 3: Zagora vs Plain TypeScript

| Aspect | Zagora | Plain TypeScript |
|--------|--------|------------------|
| Runtime validation | Yes (StandardSchema) | Manual implementation |
| Compile-time types | Yes (full inference) | Manual type annotations |
| Error handling | Structured `{ ok, error }` | try/catch or manual |
| Default values at runtime | Automatic from schema | Manual implementation |
| Tuple argument spreading | Built-in | Not applicable |
| Caching/memoization | Built-in adapter | Manual implementation |
| Context injection | Built-in | Manual prop drilling |

**Philosophy**: Plain TypeScript offers types but no runtime guarantees. Zagora bridges the gap with runtime validation while maintaining full type inference. You get the ergonomics of pure functions with the safety of schema validation.

#### Table 4: Zagora vs Standalone Validators (Zod/Valibot)

| Aspect | Zagora | Zod/Valibot alone |
|--------|--------|-------------------|
| Fluent builder pattern | Yes (`.input().output().handler()`) | Manual composition |
| Unified result shape | Yes (`{ ok, data, error }`) | `.parse()` throws, `.safeParse()` returns |
| Typed error helpers | Yes (from schema definitions) | No |
| Handler definition | Integrated | Separate from validation |
| Multiple arguments | Yes (tuple schemas spread) | Manual handling |
| Context injection | Built-in | Not applicable |
| Caching integration | Built-in | Manual |
| Env vars validation | Built-in | Manual setup |

**Philosophy**: Standalone validators are great for data validation but require boilerplate for function composition. Zagora provides an ergonomic layer that unifies input/output/error validation with handler definition in a cohesive, type-safe API.

---

## Documentation Structure

### Sidebar Navigation

```
Getting Started
├── Introduction
├── Installation
├── Quick Start
└── Why Zagora?

Core Concepts
├── Procedures
├── Input Validation
├── Output Validation
├── Typed Errors
├── Error Type Guards
├── Context Management
└── Handler Options

Features
├── Tuple Arguments
├── Default Values
├── Async Support
├── Caching & Memoization
├── Environment Variables
├── Auto-Callable Mode
└── Never-Throwing Guarantees

API Reference
├── zagora(config)
├── Instance Methods
├── Error Types
└── ZagoraResult Type

Comparisons
├── vs oRPC / tRPC
├── vs neverthrow / Effect
├── vs Plain TypeScript
└── vs Standalone Validators

Advanced
├── Type Safety Guarantees
├── Building Routers
├── Testing Procedures
└── Best Practices

Resources
├── AGENTS.md (LLM Rules)
└── Changelog
```

### Top Navigation

```
Docs | API | Comparisons | GitHub
```

---

## File Structure

```
apps/docs/
├── docs/
│   ├── pages/
│   │   ├── index.mdx                    # Homepage
│   │   ├── docs/
│   │   │   ├── getting-started.mdx      # Introduction
│   │   │   ├── installation.mdx
│   │   │   ├── quick-start.mdx
│   │   │   ├── why-zagora.mdx
│   │   │   ├── procedures.mdx
│   │   │   ├── input-validation.mdx
│   │   │   ├── output-validation.mdx
│   │   │   ├── typed-errors.mdx
│   │   │   ├── error-guards.mdx
│   │   │   ├── context.mdx
│   │   │   ├── handler-options.mdx
│   │   │   ├── tuple-arguments.mdx
│   │   │   ├── default-values.mdx
│   │   │   ├── async-support.mdx
│   │   │   ├── caching.mdx
│   │   │   ├── env-vars.mdx
│   │   │   ├── auto-callable.mdx
│   │   │   └── never-throwing.mdx
│   │   ├── api/
│   │   │   ├── zagora.mdx
│   │   │   ├── methods.mdx
│   │   │   ├── error-types.mdx
│   │   │   └── result-type.mdx
│   │   ├── comparisons/
│   │   │   ├── rpc-frameworks.mdx
│   │   │   ├── error-libraries.mdx
│   │   │   ├── plain-typescript.mdx
│   │   │   └── standalone-validators.mdx
│   │   ├── advanced/
│   │   │   ├── type-safety.mdx
│   │   │   ├── building-routers.mdx
│   │   │   ├── testing.mdx
│   │   │   └── best-practices.mdx
│   │   └── agents.mdx                   # AGENTS.md rules for LLMs
│   ├── public/
│   │   ├── favicon.ico                  # Orange Z favicon
│   │   └── og-image.png                 # Open Graph image
│   ├── components/
│   │   ├── FeatureCard.tsx              # Feature card component
│   │   ├── ComparisonTable.tsx          # Comparison table component
│   │   └── HeroExample.tsx              # Hero code example
│   ├── styles.css                       # Custom styles
│   └── footer.tsx                       # Footer component
├── vocs.config.ts                       # Vocs configuration
├── package.json                         # Workspace package
└── tsconfig.json                        # TypeScript config
```

---

## LLM Documentation (llms.txt)

**Vocs has built-in llms.txt generation!** 

Vocs automatically generates `llms.txt` and `llms-full.txt` during build via an internal Vite plugin (`src/vite/plugins/llms.ts`).

### How it works:
1. **llms.txt**: Auto-generated list of all docs pages with titles and descriptions (extracted from H1 headings and first paragraphs)
2. **llms-full.txt**: Full markdown content of all docs concatenated together
3. **Optional `generateMarkdown`**: Can also generate individual `.md` files alongside HTML pages

### Configuration:

```ts
// vocs.config.ts
export default defineConfig({
  // ... other config
  llms: {
    generateMarkdown: true, // Optional: also generate .md files for each page
  },
});
```

### What gets generated:
- `/llms.txt` - Summary with links to all docs pages and descriptions
- `/llms-full.txt` - Full markdown content of entire documentation
- (optional) `*.md` files alongside HTML if `generateMarkdown: true`

### Content structure:
The llms.txt file will automatically include:
- Library name and description (from `title` and `description` config)
- Links to all docs pages with their titles and first-paragraph descriptions
- Properly formatted markdown for LLM consumption

**No manual llms.txt creation needed** - Vocs handles this automatically during build!

---

## Technical Implementation Notes

### Vocs Configuration Highlights

```ts
// vocs.config.ts
import { defineConfig } from 'vocs';

export default defineConfig({
  title: 'Zagora',
  description: 'Build type-safe, error-safe functions that never throw.',
  baseUrl: 'https://zagora.dev', // or GitHub Pages URL
  theme: {
    accentColor: '#f97316', // Orange-500
  },
  socials: [
    { icon: 'github', link: 'https://github.com/tunnckoCore/zagora' },
  ],
  sidebar: { /* ... structured as above ... */ },
  topNav: [
    { text: 'Docs', link: '/docs/getting-started', match: '/docs' },
    { text: 'API', link: '/api/zagora', match: '/api' },
    { text: 'Comparisons', link: '/comparisons/rpc-frameworks', match: '/comparisons' },
  ],
  editLink: {
    pattern: 'https://github.com/tunnckoCore/zagora/edit/main/apps/docs/docs/pages/:path',
    text: 'Edit on GitHub'
  },
  // Enable llms.txt generation (built-in to Vocs)
  llms: {
    generateMarkdown: true, // Also generate .md files alongside HTML
  },
});
```

### Package.json for docs workspace

```json
{
  "name": "@zagora/docs",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vocs dev",
    "build": "vocs build",
    "preview": "vocs preview"
  },
  "dependencies": {
    "vocs": "^1.0.0-alpha.62"
  },
  "devDependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  }
}
```

### Root package.json update

Add to workspaces scripts for convenience:
```json
{
  "scripts": {
    "docs:dev": "bun --cwd apps/docs dev",
    "docs:build": "bun --cwd apps/docs build",
    "docs:preview": "bun --cwd apps/docs preview"
  }
}
```

---

## Implementation Phases

### Phase 1: Setup & Infrastructure
1. Create `apps/docs` directory structure
2. Initialize package.json for docs workspace
3. Configure vocs.config.ts with theme and navigation
4. Set up basic styles.css with orange/amber theme
5. Create footer.tsx component
6. Add scripts to root package.json
7. Run `bun install` to set up workspace

### Phase 2: Homepage
1. Create index.mdx with HomePage component
2. Implement hero section with tagline and code example
3. Create FeatureCard component (or use Vocs built-in cards)
4. Build 10 feature cards with rephrased content
5. Add comparison tables section

### Phase 3: Core Documentation
1. Getting Started section (4 pages)
2. Core Concepts section (7 pages)
3. Features section (7 pages)

### Phase 4: API & Advanced
1. API Reference section (4 pages)
2. Comparisons section (4 pages)
3. Advanced section (4 pages)

### Phase 5: Polish & Review
1. Add Open Graph image
2. Add favicon (orange Z)
3. Test llms.txt generation (built-in, just verify output)
4. Final content review and polish
5. Test build and preview

---

## Summary of Decisions

| Decision | Choice |
|----------|--------|
| Tagline | "Build type-safe, error-safe functions that never throw. Full TypeScript inference with tuple arguments, sync/async awareness, and typed error handling. Just pure functions—no routers, no network layer, no unwrapping." |
| Theme Color | Orange/Amber (#f97316) |
| Logo | Text-only "Zagora" for now |
| Comparison Style | Feature matrices with philosophy explanations |
| LLMs.txt | Built-in Vocs generation (auto) |
| Framework | Vocs (React/Vite) |
| Workspace Location | apps/docs |

---

## Next Steps After Plan Approval

1. Review and approve this plan
2. Proceed with Phase 1 implementation
3. Iterate on content and design as needed
