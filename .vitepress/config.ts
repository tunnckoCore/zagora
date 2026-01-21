import { transformerTwoslash } from "@shikijs/vitepress-twoslash";
import { defineConfig } from "vitepress";

// https://vitepress.dev/reference/site-config
export default defineConfig({
  srcDir: "docs",

  title: "Zagora",
  titleTemplate: "%s - Zagora",
  description:
    "Type-safe functions with full inference, typed errors, and zero async overhead -- just pure TypeScript. Skip the complexity of RPC frameworks or Effect.ts and build libraries and APIs, the Robust Way",

  markdown: {
    codeTransformers: [transformerTwoslash({
      onTwoslashError: () => { }
    })],
    languages: ['ts', 'tsx']
  },
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: "Docs", link: "/docs/getting-started", activeMatch: "/docs" },
      { text: "API", link: "/api/zagora", activeMatch: "/api" },
      {
        text: "Comparisons",
        link: "/comparisons/rpc-frameworks",
        activeMatch: "/comparisons",
      },
      {
        text: "Guides",
        link: "/advanced/type-safety",
        activeMatch: "/advanced",
      },
      {
        text: "LLMs.txt",
        link: "https://zagora.wgw.lol/llms.txt",
      },
      {
        text: "GitHub",
        link: "https://github.com/tunnckoCore/zagora/tree/feat/docs",
      },
    ],

    sidebar: {
      "/docs": [
        {
          text: "Getting Started",
          items: [
            { text: "Introduction", link: "/docs/getting-started" },
            { text: "Installation", link: "/docs/installation" },
            { text: "Quick Start", link: "/docs/quick-start" },
            { text: "Why Zagora?", link: "/docs/why-zagora" },
          ],
        },
        {
          text: "Core Concepts",
          items: [
            { text: "Procedures", link: "/docs/procedures" },
            { text: "Input Validation", link: "/docs/input-validation" },
            { text: "Output Validation", link: "/docs/output-validation" },
            { text: "Typed Errors", link: "/docs/typed-errors" },
            { text: "Error Type Guards", link: "/docs/error-guards" },
            { text: "Context Management", link: "/docs/context" },
            { text: "Handler Options", link: "/docs/handler-options" },
          ],
        },
        {
          text: "Features",
          items: [
            { text: "Tuple Arguments", link: "/docs/tuple-arguments" },
            { text: "Default Values", link: "/docs/default-values" },
            { text: "Async Support", link: "/docs/async-support" },
            { text: "Caching & Memoization", link: "/docs/caching" },
            { text: "Environment Variables", link: "/docs/env-vars" },
            { text: "Auto-Callable Mode", link: "/docs/auto-callable" },
            { text: "Never-Throwing Guarantees", link: "/docs/never-throwing" },
          ],
        },
      ],
      "/api": [
        {
          text: "API Reference",
          items: [
            { text: "zagora(config)", link: "/api/zagora" },
            { text: "Instance Methods", link: "/api/methods" },
            { text: "Error Types", link: "/api/error-types" },
            { text: "ZagoraResult Type", link: "/api/result-type" },
          ],
        },
      ],
      "/comparisons": [
        {
          text: "Comparisons",
          items: [
            { text: "vs oRPC / tRPC", link: "/comparisons/rpc-frameworks" },
            {
              text: "vs neverthrow / Effect",
              link: "/comparisons/functional-libraries",
            },
            {
              text: "vs Plain TypeScript",
              link: "/comparisons/plain-typescript",
            },
            {
              text: "vs Standalone Validators",
              link: "/comparisons/standalone-validators",
            },
          ],
        },
      ],
      "/advanced": [
        {
          text: "Advanced",
          items: [
            { text: "Type Safety Deep Dive", link: "/advanced/type-safety" },
            { text: "Building Routers", link: "/advanced/building-routers" },
            { text: "Generating OpenAPI", link: "/advanced/openapi" },
            { text: "Testing Procedures", link: "/advanced/testing" },
            { text: "Best Practices", link: "/advanced/best-practices" },
          ],
        },
      ],
    },

    socialLinks: [
      {
        icon: "github",
        link: "https://github.com/tunnckoCore/zagora/tree/feat/docs",
      },
      { icon: "x", link: "https://twitter.com/wgw_eth" },
      { icon: "npm", link: "https://npmjs.com/package/zagora" },
    ],

    editLink: {
      pattern:
        "https://github.com/tunnckoCore/zagora/edit/feat/docs/docs/:path",
      text: "Edit on GitHub",
    },
  },
});
