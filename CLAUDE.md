---
name: guidelines
description: Behavioral guidelines to reduce common LLM coding mistakes. Use when writing, reviewing, or refactoring code to avoid overcomplication, make surgical changes, surface assumptions, and define verifiable success criteria.
license: MIT
---

## Development Rules

**Before Committing:**
- Run `pnpm lint` (required for type safety)
- Use `pnpm format` (Biome formatting)

**Code Standards:**
- **TypeScript:** No `any`, `unknown`, or `as` casting
- **State management:**
  - Always name atoms: `atom(0, 'counter')`
  - Use `computed()` for derived values, NOT `atom(() => {})`
  - Use `wrap()` for all async operations (preserves context)
  - Use factory pattern (prefix with `create*`) instead of atom families. Example: `createProductsEditor('myProducts')`
  - Note: `reatom*` prefix was used during migration, prefer `create*` for new factories
  - Atomize complex objects into granular atoms
- **🚨 Component Wrapping Rule:** ANY component with `"use client"` OR using ANY React hook (`use*`) MUST be wrapped with `reatomComponent`:
  ```tsx
  // ✅ CORRECT
  export const Component = reatomComponent(() => {
    const value = useSomeHook()
    return <div>{value}</div>
  }, "Component")

  // ❌ WRONG (breaks reactivity)
  export function Component() {
    const value = useSomeHook()
    return <div>{value}</div>
  }
  ```
- **i18n:** Extract strings with `pnpm lingui-extract`
- **Exports:** Prefer named exports; avoid default exports (harder to rename and search)

**Current Focus:** MegaETH Testnet deployment

## Documentation Guidelines

### Memory and Reference System
- **Use docs/ folder as extended memory**: Always check `/docs/` directory for existing documentation before creating new content or answering questions about system behavior
- **Reference verification**: When documenting code behavior, always include references to source files with specific line numbers or function names where the information can be verified
- **Documentation sources**: Acceptable references include:
  - File paths with line numbers (e.g., `src/file.ts:42`)
  - Function names and their locations (e.g., `computeOriginFeesForSeaport` in `seaport-multi-buy.ts`)
  - Configuration files with specific properties (e.g., `feesVersion: "v3"` in `rari.ts:22`)

### Information Architecture (Ilyahov Style)
After updating any documentation, apply "infostyle" principles:

**Structure Requirements:**
- **Lead with the main point** - Put the most important information first
- **Use scannable formatting** - Headers, bullet points, and numbered lists for easy navigation
- **Provide concrete examples** - Include code snippets, file paths, and specific values
- **Group related information** - Organize content logically with clear sections
- **Include verification paths** - Always show readers how to verify claims independently

**Writing Style:**
- **Be specific and concrete** - Use exact addresses, percentages, and file names instead of vague descriptions
- **Use action-oriented language** - Focus on what users can do and verify
- **Eliminate redundancy** - Remove repetitive explanations and focus on unique information
- **Front-load key details** - Put critical information (addresses, rates, file locations) at the beginning of sections


Info Style Rules (by Maxim Ilyakhov, Write, Shorten)

Care about the reader.
Write so the reader finds it easy, clear, and useful.

Meaning over form.
Cut out bureaucratic clichés, jargon, and filler words.

Cut the excess.
Remove duplicates, obvious things, and fluff. Every word must work.

Be specific.
Replace abstractions with facts, numbers, and examples.

Use active voice.
“We did it” is better than “It was done.”

Structure the text.
One paragraph = one idea. Use headings, lists, and steps.

Start with the main point.
Invert the pyramid: key idea first, details later.

Explain terms.
If a word may be unclear, explain it in plain language.

Avoid vague judgments.
Not “fast,” but “in 2 minutes.” Not “many,” but “200 people.”

Edit ruthlessly.
Revise in passes: cut → clarify → simplify.

Prompt for Writing Documentation in Info Style

✍️ Prompt:

“Rewrite this text in Maxim Ilyakhov’s info style (from the book Write, Shorten). Make it clear, useful, and concise.

Apply the rules:

cut filler and duplication,

use active voice,

put the conclusion first,

explain terms,

replace abstractions with facts,

break text into short paragraphs, lists, and steps.

The final document should be simple, structured, and reader-friendly.”


# Coding Guidelines

Behavioral guidelines to reduce common LLM coding mistakes on LLM coding pitfalls.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.