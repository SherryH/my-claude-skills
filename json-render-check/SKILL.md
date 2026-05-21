---
name: json-render-check
description: Check if a React component's prop interface is ready for json-render migration. Use when building or reviewing dashboard components to validate they follow serializable prop conventions.
---

# json-render Readiness Check

## Input

A file path to a React component (e.g., `src/frontend/components/admin/overview/HeroMetricCard.tsx`).

If no file path is provided, ask the user which component to check.

## Process

Read `.ai/json-render-readiness.md` for the full check definitions and follow the 6 checks described there. Use Grep and Read tools to investigate the component file.

## Output

Follow the output format defined in `.ai/json-render-readiness.md`.
