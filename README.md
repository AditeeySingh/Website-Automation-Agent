# 🤖 AI-Powered Website Automation Agent

An autonomous, AI-driven browser automation agent capable of navigating web pages, visually identifying form fields, and executing interactions (clicking, scrolling, typing) without hardcoded DOM CSS selectors. 

Built using **Playwright** for browser instrumentation and **Google Gemini** for multimodal vision and orchestrating decisions.

---

## 📸 Interactive Demonstration

The agent autonomously solves the form-filling task at the `ui.shadcn.com` React Hook Form documentation page:

### 1. Navigation & Scrolling
The agent launches Chromium, navigates to the page, and scrolls down to locate the interactive **Bug Report** form preview.

![Initial Page Load](./assets/initial_page.png)

### 2. Auto-Filled Form (Success)
The agent visually analyzes the form's layout, determines the pixel coordinates of the fields, clicks to focus, and types in the values (using natural keyboard entry delays).

![Filled Bug Report Form Card](./assets/filled_form.png)

---

## ✨ Features

- **Decoupled Three-Layer Architecture:** decoulped orchestration (`agent.js`), AI vision engine (`gemini.js`), and Playwright drivers (`tools.js`).
- **Visual Coordinate Targeting:** Behaviour is completely framework-agnostic. The agent clicks on elements using visual coordinate estimation (`page.mouse.click(x, y)`) rather than relying on brittle CSS selectors or shadow DOM paths.
- **Human-like typing:** Types character-by-character with a configurable keypress delay (`50ms`) to satisfy React/Zod listeners and avoid validation race conditions.
- **Resilient Retry Queue:** Implements exponential backoff to handle transient API issues, including rate limits (`429`) and model load spikes (`503`).
- **Robust JSON Parsing:** Extracts action commands safely using bracket matching, making parsing immune to conversational text added by the LLM wrapper.

---

## 🚀 Getting Started

Follow these steps to run the agent locally on your machine.

### Prerequisites
- **Node.js** (v18 or higher)
- **npm** (comes with Node.js)
- A **Google Gemini API Key** (Get a free key from [Google AI Studio](https://aistudio.google.com/apikey))

### 1. Clone the Repository
```bash
git clone https://github.com/AditeeySingh/Website-Automation-Agent.git
cd Website-Automation-Agent
```

### 2. Install Node Dependencies
```bash
npm install
```

### 3. Install Playwright Browsers
```bash
npx playwright install chromium
```

### 4. Configure Environment Key
Copy the template `.env.example` file to `.env`:
```bash
cp .env.example .env
```
Open `.env` and configure your API key:
```env
GEMINI_API_KEY=AIzaSy...your_gemini_api_key
```

---

## 💻 How to Run

### Standard Run (Headed Mode)
Launches a headed Chromium browser window so you can watch the AI agent interact in real time:
```bash
npm start
```

### Verbose Mode (Detailed Console Outputs)
Prints deep-dive trace logs for every screenshot capture, API call, and coordinate action:
```bash
npm run demo
```

---

## 🛠️ Project Architecture

```
Website-Automation-Agent/
├── assets/            ← Static screenshots showing the agent in action
├── src/               
│   ├── main.js        ← Entry point (defines target task instructions)
│   ├── agent.js       ← Observe-Think-Act state machine orchestrator
│   ├── tools.js       ← Playwright automation tool wrappers
│   ├── gemini.js      ← Gemini API client & system instruction prompt
│   └── logger.js      ← Color-coded terminal and file logging utility
├── .gitignore         
├── .env.example       ← Configuration template
├── package.json       
└── ARCHITECTURE.md    ← Comprehensive documentation on design decisions
```
