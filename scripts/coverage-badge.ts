#!/usr/bin/env bun

/**
 * Coverage Badge Analyzer
 * Parses lcov.info file and calculates test coverage percentage
 * Usage: bun scripts/coverage-badge.ts
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

interface CoverageMetrics {
  linesFound: number;
  linesHit: number;
  functionsFound: number;
  functionsHit: number;
  branchesFound: number;
  branchesHit: number;
}

function parseLcovFile(filePath: string): CoverageMetrics {
  if (!existsSync(filePath)) {
    console.error(`❌ Coverage file not found: ${filePath}`);
    console.error("Run tests with coverage first: bun run ci:test");
    return process.exit(1);
  }

  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  const metrics: CoverageMetrics = {
    linesFound: 0,
    linesHit: 0,
    functionsFound: 0,
    functionsHit: 0,
    branchesFound: 0,
    branchesHit: 0,
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // Use summary lines (LF/LH for lines, FNF/FNH for functions, BRF/BRH for branches)
    if (trimmed.startsWith("LF:")) {
      metrics.linesFound += parseInt(trimmed.substring(3), 10);
    } else if (trimmed.startsWith("LH:")) {
      metrics.linesHit += parseInt(trimmed.substring(3), 10);
    }
    // Functions found/hit (FNF/FNH)
    else if (trimmed.startsWith("FNF:")) {
      metrics.functionsFound += parseInt(trimmed.substring(4), 10);
    } else if (trimmed.startsWith("FNH:")) {
      metrics.functionsHit += parseInt(trimmed.substring(4), 10);
    }
    // Branches found/hit (BRF/BRH)
    else if (trimmed.startsWith("BRF:")) {
      metrics.branchesFound += parseInt(trimmed.substring(4), 10);
    } else if (trimmed.startsWith("BRH:")) {
      metrics.branchesHit += parseInt(trimmed.substring(4), 10);
    }
  }

  return metrics;
}

function calculateCoverage(metrics: CoverageMetrics): number {
  // Weighted average: lines (60%), functions (25%), branches (15%)
  let totalWeight = 0;
  let weightedSum = 0;

  if (metrics.linesFound > 0) {
    const linesCoverage = (metrics.linesHit / metrics.linesFound) * 100;
    weightedSum += linesCoverage * 0.6;
    totalWeight += 0.6;
  }

  if (metrics.functionsFound > 0) {
    const functionsCoverage =
      (metrics.functionsHit / metrics.functionsFound) * 100;
    weightedSum += functionsCoverage * 0.25;
    totalWeight += 0.25;
  }

  if (metrics.branchesFound > 0) {
    const branchesCoverage =
      (metrics.branchesHit / metrics.branchesFound) * 100;
    weightedSum += branchesCoverage * 0.15;
    totalWeight += 0.15;
  }

  // If no data, return 0
  if (totalWeight === 0) {
    return 0;
  }

  // Normalize by actual total weight (in case some metrics are missing)
  return weightedSum / totalWeight;
}

function main() {
  const lcovPath = join(process.cwd(), "coverage", "lcov.info");

  // console.log("📊 Analyzing test coverage...");

  const metrics = parseLcovFile(lcovPath);
  const coverage = calculateCoverage(metrics);

  const cov = {
    value: coverage.toFixed(2),
    color: coverageColor(coverage),
  };

  // Calculate individual percentages
  // const linesCoverage =
  //   metrics.linesFound > 0 ? (metrics.linesHit / metrics.linesFound) * 100 : 0;
  // const functionsCoverage =
  //   metrics.functionsFound > 0
  //     ? (metrics.functionsHit / metrics.functionsFound) * 100
  //     : 0;
  // const branchesCoverage =
  //   metrics.branchesFound > 0
  //     ? (metrics.branchesHit / metrics.branchesFound) * 100
  //     : 0;

  // Display detailed metrics
  // console.log("Coverage Breakdown:");
  // console.log(
  //   `  Lines:     ${metrics.linesHit}/${metrics.linesFound} (${linesCoverage.toFixed(2)}%)`,
  // );
  // console.log(
  //   `  Functions: ${metrics.functionsHit}/${metrics.functionsFound} (${functionsCoverage.toFixed(2)}%)`,
  // );
  // console.log(
  //   `  Branches:  ${metrics.branchesHit}/${metrics.branchesFound} (${branchesCoverage.toFixed(2)}%)`,
  // );
  console.log("");
  console.log(`Overall Coverage: ${cov.value}%`);
  console.log(`Badge Color: ${cov.color}`);
  console.log("");

  // Output for CI/CD or badge generation
  const badgeUrl = `https://badgen.net/badge/coverage/${cov.value}%25/${cov.color}`;

  // Update README.md badge
  const readmePath = join(process.cwd(), "README.md");
  if (existsSync(readmePath)) {
    const readme = readFileSync(readmePath, "utf-8");

    const badgeRegex = /<!-- COV_BADGE:START -->.*?<!-- COV_BADGE:END -->/s;
    const newBadge = `<!-- COV_BADGE:START -->![coverage](${badgeUrl})<!-- COV_BADGE:END -->`;

    const readmeContent = readme.replace(badgeRegex, newBadge);
    writeFileSync(readmePath, readmeContent, "utf-8");

    console.log("✔ Updated coverage badge in README.md");
  } else {
    console.warn("⚠️  README.md not found, skipping badge update");
  }

  // Output just the number for piping
  if (process.argv.includes("--json")) {
    console.clear();
    console.log(JSON.stringify(cov));
  }

  // Exit with error code if coverage is below threshold
  const threshold = parseFloat(process.env.COVERAGE_THRESHOLD || "0");
  if (threshold > 0 && coverage < threshold) {
    console.error(
      `❌ Coverage ${coverage.toFixed(2)}% is below threshold ${threshold}%`,
    );
    return process.exit(1);
  }
}

function coverageColor(value, colors = {}) {
  const defaultColors = { green: 100, yellow: 85, orange: 70, red: 35 };
  const { red, orange, yellow, green } = { ...defaultColors, ...colors };

  if (!value) {
    return "grey";
  }
  if (value < red) {
    return "red";
  }
  if (value < orange) {
    return "orange";
  }
  if (value < yellow) {
    return "EEAA22";
  }
  if (value < green) {
    return "99CC09";
  }
  return "green";
}

main();
