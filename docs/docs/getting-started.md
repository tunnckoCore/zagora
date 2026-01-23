---
description: "Introduction to Zagora. Zagora enables building type-safe and error-safe procedures that encapsulate business logic with robust validation, error handling, and context management."
head:
  - - meta
    - property: og:description
      content: "Introduction to Zagora. Zagora enables building type-safe and error-safe procedures that encapsulate business logic with robust validation, error handling, and context management."
---

# Getting Started

Zagora enables building type-safe and error-safe procedures that encapsulate business logic with robust validation, error handling, and context management.

## What is Zagora?

Zagora is a minimalist TypeScript library for creating type-safe, error-safe functions that never throw. Unlike oRPC or tRPC, Zagora focuses on producing pure functions—no network layer, no routers, just regular TypeScript functions with superpowers.

## Key Features

- **Full Type Inference** - Complete TypeScript inference across inputs, outputs, errors, and context
- **Never Throws** - Every function returns `{ ok, data, error }` for predictable execution
- **Tuple Arguments** - Define multiple function arguments with per-argument validation
- **Sync & Async** - Dynamic inference based on handler behavior
- **StandardSchema** - Works with Zod, Valibot, ArkType, and any compliant validator

## Installation

```bash
bun add zagora
```

## Quick Start

```ts
import { z } from 'zod';
import { zagora } from 'zagora';

const greet = zagora()
  .input(z.string())
  .handler((_, name) => `Hello, ${name}!`)
  .callable();

const result = greet('World');
if (result.ok) {
  console.log(result.data); // "Hello, World!"
}
```
