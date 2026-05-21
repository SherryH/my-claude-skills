# Design Generation Skill

A Claude Code skill that orchestrates UI design generation using **Gemini as a rendering engine**, **Claude as the orchestrator**, and **Playwright as a visual validator**.

---

## WHY

### The Problem

Generating UI designs from screenshot references requires three capabilities that no single tool provides alone:

| Capability | Claude Code | Gemini CLI | Playwright |
|-----------|-------------|------------|------------|
| Read/understand images | Yes | Yes (via `@`) | No |
| Generate visual designs | Adequate | **Strong** | No |
| Read project code & context | **Yes** | No (headless) | No |
| Write files | **Yes** | No (headless) | No |
| Render HTML visually | No | No | **Yes** |
| Iterate with user | **Yes** | No | No |

No single tool covers the full pipeline. The skill combines all three.

### What Failed Before

We tried three approaches before arriving at this architecture:

**1. Gemini CLI wrapper (`ui-redesign` bash script):**
- Passed image paths as text strings — Gemini never saw the images
- Shell escaping broke with long prompts
- Gemini couldn't write output files in headless mode
- Generated design was "hallucinated" (not grounded in actual screenshots)

**2. Gemini in agent mode (interactive):**
- Two competing agent loops (Claude + Gemini) fighting over the same workspace
- Gemini's tool calls (`read_file`, `write_file`) failed or were rate-limited
- Non-deterministic: Gemini made autonomous decisions Claude couldn't control
- Violated single-responsibility principle

**3. Claude doing everything alone:**
- Works, but user reports Gemini produces stronger visual design output
- No visual validation step (can't render HTML to verify)

### The Insight

**Treat Gemini as a compiler, not an architect.**

Like `Make` calling `gcc`: the build system (Claude) decides what to build, the compiler (Gemini) renders it, and tests (Playwright) verify the output. The compiler doesn't manage the project — it compiles what it's given.

---

## WHAT

### Architecture

```
Claude → Gemini (render HTML) → Playwright (validate) ─┬→ HTML output
                                                        └→ Pencil MCP (.pen editable)

Orchestrator   Pure Function       Verifier          Parallel Outputs
```

### Data Flow

```
Phase 1: CONTEXT (Claude only)
  ├── Read old-design.png        → understand what to preserve
  ├── Read style-reference.png   → understand target style
  ├── Read project code          → extract real design tokens
  └── Read interface-design skill → know craft principles

Phase 2: PROMPT CRAFTING (Claude only)
  └── Distill context into focused prompt with explicit tokens

Phase 3: GENERATION (Gemini headless)
  └── gemini -p "prompt @old.png @style.png" → raw HTML

Phase 4: VALIDATION (Claude + Playwright)
  ├── Playwright renders HTML → screenshot
  ├── Claude compares screenshot vs style reference
  └── Claude checks craft principles (squint, token, signature tests)

Phase 5: ITERATION or FINALIZE
  ├── Fail → Refine prompt → back to Phase 3 (max 3 attempts)
  └── Pass → Phase 6 (parallel outputs)

Phase 6: OUTPUT (parallel)
  ├── Write HTML file to target location
  └── Export to Pencil MCP (.pen) for visual tweaking
```

### Separation of Concerns

| Responsibility | Owner | Rationale |
|---------------|-------|-----------|
| User interaction | Claude | Already the user's interface |
| Project context | Claude | Can read files, grep code |
| Image understanding | Both | Claude reads to understand; Gemini reads to generate |
| Design generation | **Gemini** | Stronger visual design output |
| Prompt crafting | Claude | Has full context to write precise specs |
| File operations | Claude | Has Write/Edit tools |
| Visual rendering | **Playwright** | Only tool that can render HTML |
| Quality validation | Claude + Playwright | Claude applies principles, Playwright provides visual evidence |
| Editable design output | **Pencil MCP** | Native .pen file for visual tweaking after validation |
| Error recovery | Claude | Can modify prompt, retry, ask user |
| Iteration | Claude | Maintains conversation state |

---

## HOW

### Prerequisites

#### 1. Gemini CLI (Required)

```bash
# Verify installation
gemini --version

# Verify authentication (should return a response)
gemini -p "Hello" --output-format json
```

**Install:** Follow [Gemini CLI setup](https://github.com/google-gemini/gemini-cli)

**Key feature used:** The `@` file reference syntax for passing images:
```bash
gemini -p "Describe this: @screenshot.png"
```

This was verified to work in headless `-p` mode. Gemini processes the actual image pixels, not just the file path.

#### 2. Playwright MCP (Recommended)

Configured in `~/.claude/mcp_config.json`. Used for visual validation — rendering generated HTML and capturing screenshots for comparison.

**Without Playwright:** The skill still works but validation falls back to manual HTML source review (checking class names and hex values). This is weaker because CSS can look correct in code but render incorrectly.

**What Playwright catches that code review can't:**
- Overlapping elements
- Broken responsive layouts
- Text overflow/truncation
- Visual hierarchy issues
- Incorrect spacing accumulation

#### 3. Interface Design Skill (Recommended)

Located at `~/.gemini/skills/interface-design/SKILL.md`. Provides design principles that Claude uses for:

- **Pre-generation:** Knowing what craft checks to specify in the prompt
- **Post-validation:** Evaluating output against established design principles

**The four craft checks from the skill:**
- **Swap Test:** Would swapping for common alternatives feel different?
- **Squint Test:** Is hierarchy visible when blurred?
- **Signature Test:** Can you point to 5 specific distinctive elements?
- **Token Test:** Do CSS variables sound like this product?

### Usage

#### From conversation:

```
User: "Create a new design for the Single Choice survey editor
       that matches the Touchpoint Story Module style"
       [attaches old-design.png and style-reference.png]

Claude: [invokes design-generation skill]
```

#### Key implementation detail — prompt crafting:

The skill's value is in how Claude constructs the Gemini prompt. Rather than forwarding a vague request, Claude:

1. **Reads** both screenshots and extracts specific observations
2. **Reads** project code to find real token values
3. **Distills** into explicit constraints:

```
# What Claude sends to Gemini (focused, specific):
"Design tokens from style reference:
 - Brand: #9646ff, Cards: rounded-2xl, Inputs: rounded-xl
 - Font: Inter 400/500/600, Labels: text-xs uppercase tracking-wider

Functional requirements from old design:
 - Question title (30 char limit), description (optional, 200 char)
 - Choice list: drag reorder, image upload per choice, delete button
 - Required toggle, List/Grid layout selector, color pickers"
```

vs.

```
# What the old CLI sent to Gemini (unfocused, 5000 words):
"[entire SKILL.md content] ... migrate the design ..."
```

### Validation Loop

```
┌─────────────────────┐
│  Gemini generates    │
│  HTML output         │
└──────────┬──────────┘
           ▼
┌─────────────────────┐
│  Claude writes to    │
│  /tmp/design.html    │
└──────────┬──────────┘
           ▼
┌─────────────────────┐     ┌──────────────────────┐
│  Playwright renders  │────▶│  Claude reads         │
│  and screenshots     │     │  screenshot           │
└─────────────────────┘     └──────────┬───────────┘
                                       ▼
                            ┌─────────────────────┐
                            │  Compare against     │
                            │  style reference     │
                            └──────────┬───────────┘
                                       ▼
                            ┌─────────────────────┐
                     pass   │                     │  fail
                   ┌────────│  Craft checks pass? │────────┐
                   ▼        │                     │        ▼
          ┌──────────────┐  └─────────────────────┘  ┌──────────────┐
          │ Write final  │                           │ Refine prompt│
          │ output file  │                           │ (max 3x)    │
          └──────────────┘                           └──────────────┘
```

### Error Handling

| Error | Cause | Recovery |
|-------|-------|----------|
| `gemini: command not found` | CLI not installed | Ask user to install Gemini CLI |
| 429 rate limit | Model capacity exhausted | Wait 30s and retry, or ask user to try later |
| Empty output | Prompt too long or malformed | Simplify prompt, check `@` paths are correct |
| Markdown-wrapped HTML | Gemini included explanation | Strip content between triple backtick markers |
| Playwright unavailable | MCP not configured | Fall back to manual HTML review |
| Design doesn't match style | Gemini interpretation differs | Add specific corrections to prompt and regenerate |

---

## Design Decisions

### Why headless (`-p`) over agent mode?

Agent mode creates a second autonomous agent loop that competes with Claude for workspace control. It tries to read files, write files, and make decisions — all things Claude already does better with full context. Headless mode makes Gemini a **pure function**: prompt in, HTML out, no side effects.

### Why Claude crafts the prompt instead of forwarding the user's request?

Claude has access to the actual project code, conversation history, and can read the reference images. It can extract specific design tokens (`#9646ff`, `rounded-2xl`) rather than making Gemini guess. A precise prompt produces better output than a vague one.

### Why Playwright for validation instead of just reading the HTML?

CSS can appear correct in source but render incorrectly. Overlapping elements, broken responsive layouts, and visual hierarchy issues are only visible when rendered. Playwright provides the visual evidence that code review cannot.

### Why max 3 iterations?

Diminishing returns. If the prompt + images can't produce acceptable output in 3 attempts, the issue is likely fundamental (wrong approach, incompatible style references) and needs human guidance rather than more retries.

---

## File Structure

```
~/.claude/skills/design-generation/
├── SKILL.md     # Main skill reference (required)
└── README.md    # This file — architecture docs
```

## Dependencies Map

```
design-generation (this skill)
├── REQUIRED: Gemini CLI (gemini -p with @ image syntax)
│   └── Auth: Google account with Gemini access
├── RECOMMENDED: Playwright MCP
│   └── Config: ~/.claude/mcp_config.json
│   └── Purpose: Visual validation (render → screenshot → compare)
├── OPTIONAL: Pencil MCP
│   └── Check: get_editor_state succeeds
│   └── Purpose: Editable .pen output for visual tweaking after validation
├── RECOMMENDED: interface-design skill
│   └── Location: ~/.gemini/skills/interface-design/SKILL.md
│   └── Purpose: Design principles for prompt crafting + validation
└── BUILT-IN: Claude Code tools
    ├── Read (images, code, skill files)
    ├── Write (output HTML files)
    ├── Bash (gemini -p calls)
    └── Glob/Grep (find project components)
```
