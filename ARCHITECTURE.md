# Architecture Document — Website Automation Agent

This document explains the design decisions, architecture patterns, and technical rationale behind the Website Automation Agent.

---

## 1. High-Level Architecture

The system follows a three-layer architecture:

```
┌──────────────────────────────────────────────────┐
│              ORCHESTRATION LAYER                  │
│                                                   │
│  Agent (agent.js)                                │
│  • Observe → Think → Act loop                    │
│  • Step tracking & action history                │
│  • Error recovery & circuit-breaking             │
│  • Max-step termination guard                    │
├──────────────────────────────────────────────────┤
│              INTELLIGENCE LAYER                   │
│                                                   │
│  Gemini Client (gemini.js)                       │
│  • Screenshot → AI vision analysis              │
│  • Structured JSON action output                 │
│  • System prompt engineering                     │
│  • Coordinate-based element detection            │
├──────────────────────────────────────────────────┤
│              EXECUTION LAYER                      │
│                                                   │
│  Browser Tools (tools.js)                        │
│  • 7 modular Playwright-wrapped tools            │
│  • Coordinate-based interaction                  │
│  • Screenshot capture & persistence              │
│  • Human-like typing with delays                 │
└──────────────────────────────────────────────────┘
```

### Why three layers?

**Separation of concerns:** Each layer has a single responsibility:
- The **Agent** doesn't know how to click or how AI works — it just orchestrates.
- The **Gemini Client** doesn't know about Playwright — it just sees images and outputs decisions.
- The **Browser Tools** don't know about AI — they just execute browser commands.

This makes the code **testable**, **swappable** (you could replace Gemini with OpenAI), and **easy to extend**.

---

## 2. The Observe → Think → Act Loop

This is the industry-standard pattern for AI agents, used by projects like Browser-Use, Devin, and OpenAI's Computer Use.

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌──────────┐
│ OBSERVE │────▶│  THINK  │────▶│   ACT   │────▶│ EVALUATE │
│         │     │         │     │         │     │          │
│Screenshot│    │Gemini AI│     │Playwright│    │Done? Max │
│capture  │     │analysis │     │execution│     │steps?    │
└─────────┘     └─────────┘     └─────────┘     └──────────┘
      ▲                                              │
      └──────────────────────────────────────────────┘
```

### Why this pattern?

1. **Grounding:** The AI always works from the CURRENT state (screenshot), not from a stale model of the page.
2. **Self-correction:** If an action fails or hits the wrong element, the next screenshot reveals the actual state, and the AI can adjust.
3. **Simplicity:** Each iteration is independent — take a picture, make a decision, do one thing.

---

## 3. Design Decisions

### 3.1. Vision-Based vs. DOM-Based Element Detection

**Decision:** Vision-based (screenshot → Gemini coordinates).

**Alternatives considered:**
| Approach | Pros | Cons |
|----------|------|------|
| **DOM-based** (CSS selectors, XPath) | Precise, fast | Breaks with dynamic/shadow DOM, custom components |
| **Vision-based** (our approach) | Works on any UI, framework-agnostic | Coordinate estimation can be imprecise |
| **Hybrid** (DOM + Vision) | Most reliable | More complex, higher token cost |

**Rationale:** The shadcn/ui form uses Radix UI custom components with complex shadow DOM and dynamic rendering. Traditional CSS selectors would be brittle. Vision-based detection works regardless of the underlying framework because it "sees" what a human would see.

### 3.2. Why Playwright over Puppeteer?

| Factor | Playwright | Puppeteer |
|--------|-----------|-----------|
| Browser support | Chromium, Firefox, WebKit | Chromium only |
| Auto-waiting | ✅ Built-in | ❌ Manual |
| Documentation | Excellent | Good |
| API design | Modern, consistent | Older style |
| Official backing | Microsoft | Google |

**Decision:** Playwright — better auto-waiting, multi-browser support, and more robust API.

### 3.3. Why Gemini over OpenAI?

| Factor | Gemini 2.0 Flash | GPT-4 Vision |
|--------|-----------------|-------------|
| Free tier | ✅ 15 RPM | ❌ Paid only |
| Vision quality | Excellent | Excellent |
| Speed | Very fast | Moderate |
| JSON output | Reliable | Reliable |

**Decision:** Gemini 2.0 Flash — it's free, fast, and has strong vision capabilities. Perfect for a student project.

### 3.4. Coordinate-Based Clicking

**Why not use `page.click('selector')`?**

Because our AI agent reasons in **pixel space**, not DOM space. When Gemini looks at a screenshot, it sees an input field at position (640, 350) — it doesn't see CSS selectors. Using `page.mouse.click(x, y)` is the natural bridge between visual reasoning and browser control.

### 3.5. Human-Like Typing

We type with a 50ms delay between keystrokes (`{ delay: 50 }`). This:
- Looks more natural during the viva demo
- Triggers `input` and `change` events that React Hook Form relies on
- Avoids race conditions with form validation

---

## 4. Error Handling Strategy

### 4.1. Step-Level Recovery
If any action fails (wrong coordinates, element not found), the agent:
1. Records the error in history
2. Takes a new screenshot
3. Sends the error context to Gemini
4. Lets Gemini re-plan from the actual current state

### 4.2. Circuit Breaker
If 3 consecutive errors occur, the agent aborts. This prevents infinite loops.

### 4.3. Max Step Guard
A hard limit of 20 steps prevents runaway execution. The typical form-filling task completes in 8–12 steps.

### 4.4. Graceful Shutdown
The browser always closes in a `finally` block, even if an error crashes the agent.

---

## 5. Agent Workflow for the Target Task

Here's the expected sequence of actions for filling the form at `ui.shadcn.com`:

```
Step 1:  take_screenshot → See the page header and navigation
Step 2:  scroll(down, 400) → Look for the form demo
Step 3:  take_screenshot → See the form preview section
Step 4:  scroll(down, 400) → Scroll more if needed to see the full form
Step 5:  take_screenshot → Form fields visible now
Step 6:  click_on_screen(x, y) → Click on the Username input field
Step 7:  send_keys("johndoe") → Type the username
Step 8:  take_screenshot → Verify the text appeared
Step 9:  click_on_screen(x, y) → Click on the Bio/Description textarea
Step 10: send_keys("This form was...") → Type the description
Step 11: take_screenshot → Verify the text appeared
Step 12: click_on_screen(x, y) → Click the Submit button
Step 13: done → Task complete
```

The actual steps may vary because the AI adapts to what it sees!

---

## 6. Logging Architecture

Two parallel outputs:
- **Console:** Color-coded with chalk, shows real-time progress
- **File:** Plain text in `logs/`, persisted for review

Every log entry includes:
- Timestamp (ISO 8601)
- Level (INFO, ACTION, THINK, ERROR)
- Message content
- For actions: tool name, parameters, and result

---

## 7. Security Considerations

- The Gemini API key is stored in `.env` (gitignored, never committed)
- The browser runs in non-headless mode for transparency
- No data is stored server-side — all processing is local + Gemini API
- The `.env.example` file serves as documentation without exposing secrets

---

## 8. Potential Improvements

If I had more time, I would add:
1. **DOM extraction** alongside vision for hybrid element detection
2. **Retry with jitter** for Gemini API rate limits
3. **Interactive mode** where the user can override agent decisions
4. **Multi-page navigation** support for complex workflows
5. **Test suite** with mock Gemini responses for reproducible testing
