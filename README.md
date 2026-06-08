# 🤖 Website Automation Agent

An intelligent AI-powered browser automation agent that can autonomously navigate web pages, identify form elements, and fill them in — without any manual intervention.

Built with **Playwright** (browser control) and **Google Gemini** (AI vision & decision-making).

---

## 📋 Table of Contents

- [How It Works](#how-it-works)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Getting a Gemini API Key](#getting-a-gemini-api-key)
- [Running the Agent](#running-the-agent)
- [Understanding the Output](#understanding-the-output)
- [Project Structure](#project-structure)
- [Troubleshooting](#troubleshooting)

---

## How It Works

The agent follows the **Observe → Think → Act** loop:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   OBSERVE   │────▶│    THINK    │────▶│     ACT     │
│             │     │             │     │             │
│ Take a      │     │ Send to     │     │ Click, type │
│ screenshot  │     │ Gemini AI   │     │ or scroll   │
└─────────────┘     └─────────────┘     └─────────────┘
       ▲                                       │
       └───────────────────────────────────────┘
                    (repeat)
```

1. **Screenshot** the browser
2. **Send** the image to Google Gemini (AI with vision)
3. Gemini **analyzes** the screenshot and decides: *"Click here"* or *"Type this"*
4. The agent **executes** the action using Playwright
5. **Repeat** until the form is filled

---

## Prerequisites

- **Node.js** v18 or later — [Download here](https://nodejs.org/)
- **npm** (comes with Node.js)
- A **Google Gemini API key** (free) — [Get one here](https://aistudio.google.com/apikey)

Verify your setup:
```bash
node --version   # Should show v18.x.x or higher
npm --version    # Should show 9.x.x or higher
```

---

## Installation

### 1. Clone or download this project

```bash
cd /path/to/WebsiteAutomationAgent
```

### 2. Install dependencies

```bash
npm install
```

### 3. Install the Playwright browser

```bash
npx playwright install chromium
```

### 4. Set up your API key

Copy the example environment file:
```bash
cp .env.example .env
```

Open `.env` and paste your Gemini API key:
```
GEMINI_API_KEY=AIzaSy...your_key_here
```

---

## Getting a Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Sign in with your Google account
3. Click **"Create API Key"**
4. Copy the key (starts with `AIza...`)
5. Paste it into your `.env` file

> The free tier gives you **15 requests per minute** — more than enough for this agent.

---

## Running the Agent

### Standard run:
```bash
npm start
```

### Verbose mode (extra detail):
```bash
npm run demo
```

### What happens when you run it:

1. A Chrome window opens automatically
2. It navigates to `https://ui.shadcn.com/docs/forms/react-hook-form`
3. The AI takes screenshots, analyzes them, and interacts with the form
4. You can watch the browser in real-time as the agent works
5. When done, it prints a summary and saves screenshots to `./screenshots/`

---

## Understanding the Output

### Console output
```
  ℹ 🚀 Website Automation Agent
  ℹ Target: https://ui.shadcn.com/docs/forms/react-hook-form

  ✔ Browser opened (1280×720)
  ✔ Navigated to: https://ui.shadcn.com/docs/forms/react-hook-form

  ──────────────────────────────────────────────────
  Step 1
  ──────────────────────────────────────────────────

  ℹ 📸 Taking screenshot...
  ℹ 🤔 Asking Gemini for next action...
  🧠 I can see the page has loaded. I need to scroll down to find the form demo.
  ▶ scroll({"direction":"down","amount":400})
  ...
```

### Screenshots
Every step is saved as `screenshots/step_001.png`, `step_002.png`, etc. — so you can review the agent's journey.

### Log files
Full action logs are saved to `logs/agent_run_<timestamp>.log`.

---

## Project Structure

```
WebsiteAutomationAgent/
├── src/
│   ├── main.js     ← Entry point (run this)
│   ├── agent.js    ← Core Observe→Think→Act loop
│   ├── tools.js    ← 7 browser tools (Playwright wrappers)
│   ├── gemini.js   ← Gemini AI vision client
│   └── logger.js   ← Colored console + file logging
├── screenshots/    ← Auto-saved screenshots per step
├── logs/           ← Detailed action logs
├── .env            ← Your API key (not committed to git)
├── .env.example    ← Template for .env
├── .gitignore
├── package.json
├── ARCHITECTURE.md ← Design decisions document
└── README.md       ← You are here
```

---

## Troubleshooting

### "GEMINI_API_KEY is not set!"
→ Make sure you created a `.env` file with your key. See [Getting a Gemini API Key](#getting-a-gemini-api-key).

### "Browser not open" error
→ The agent tries to act before the browser is ready. This is handled automatically with retries.

### Playwright browser not found
→ Run `npx playwright install chromium` to download the browser binary.

### Agent scrolls too much / can't find the form
→ The shadcn/ui page loads dynamically. The agent may need a few scroll steps. If it times out, try running again — each run is slightly different due to AI decision-making.

### Rate limit errors from Gemini
→ The free tier allows 15 requests/minute. With 20 max steps, you should be fine. If you hit limits, wait a minute and try again.

---

## Technologies Used

| Technology | Purpose |
|-----------|---------|
| [Playwright](https://playwright.dev/) | Browser automation (launch, click, type, scroll) |
| [Google Gemini](https://ai.google.dev/) | AI vision — analyzes screenshots, decides actions |
| [Node.js](https://nodejs.org/) | JavaScript runtime |
| [dotenv](https://github.com/motdotla/dotenv) | Loads `.env` configuration |
| [chalk](https://github.com/chalk/chalk) | Colored terminal output |
