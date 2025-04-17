# oneSitePls: The AI-Powered VIBE Engine for Telegram-Driven Development 🚀

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-^5-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-^14-black?logo=next.js&logoColor=white)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-^2-3ECF8E?logo=supabase&logoColor=white)](https://supabase.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-^3-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Telegram](https://img.shields.io/badge/Telegram-Bot%20%26%20Mini%20App-blue?logo=telegram)](https://t.me/oneSitePlsBot)

**Stop *just* coding. Start *VIBING*. Build, Validate, and Launch Secure Web Apps at Lightspeed with AI & Telegram – No Local Setup Required for Contributions!**

oneSitePls isn't just another framework; it's a **revolution in development workflow**, built on the **VIBE methodology**. Developed by Pavel Solovyov ([@salavey13](https://github.com/salavey13)), it transforms web development by deeply integrating AI (Gemini, Coze) and leveraging **Telegram** as the primary interface for contribution and project management.

**Forget complex local setups and Git commands for simple contributions.** Anyone with a Telegram account can contribute ideas, suggest changes, and even generate code via AI, directly through the [@oneSitePlsBot](https://t.me/oneSitePlsBot) and its embedded **Supervibe Studio** (`/repo-xml` Mini App).

**See it in action (Screenshots from the Telegram Mini App):**

![Screenshot_2025-04-16-20-35-30-421_org telegram messenger](https://github.com/user-attachments/assets/a48418d0-edf9-4536-8074-10953d457f8d)
![Screenshot_2025-04-16-20-35-41-305_org telegram messenger](https://github.com/user-attachments/assets/342dd5f0-9668-4283-9a3c-d740e1ca5ff0)
![Screenshot_2025-04-16-20-35-52-100_org telegram messenger](https://github.com/user-attachments/assets/50f2ce5f-10ec-40c5-b24d-0e97e6aab574)
![Screenshot_2025-04-16-20-36-00-638_org telegram messenger](https://github.com/user-attachments/assets/2849b6a3-8f93-4bb3-a359-418300314f59)
![Screenshot_2025-04-16-20-40-28-944_org telegram messenger](https://github.com/user-attachments/assets/83021619-9f84-4c90-8a97-32b8409fd3d6)
![Screenshot_2025-04-16-20-40-37-927_org telegram messenger](https://github.com/user-attachments/assets/67353128-bdd2-4c2b-8e5e-4e67052584e9)
![Screenshot_2025-04-16-20-40-56-553_org telegram messenger](https://github.com/user-attachments/assets/6fc0990f-6f8a-40b3-bc7b-32a39d28cb5f)
![Screenshot_2025-04-16-20-41-07-469_org telegram messenger](https://github.com/user-attachments/assets/ba768bd5-07b3-41f5-8491-77f3036b92a2)
![Screenshot_2025-04-16-20-41-18-679_org telegram messenger](https://github.com/user-attachments/assets/b0075d49-e439-4df8-b308-ca12d773dd70)
![Screenshot_2025-04-16-20-41-27-645_org telegram messenger](https://github.com/user-attachments/assets/4d7f8013-5c7b-4172-a917-b0c8f2a255d2)

---

<details>
<summary><strong>Table of Contents</strong></summary>

- [Disclaimer](#disclaimer)
- [The VIBE Revolution](#the-vibe-revolution)
  - [What is VIBE?](#what-is-vibe)
- [Key Features](#key-features)
- [⚡ The Supervibe Workflow (Contribute via Telegram!)](#-the-supervibe-workflow-contribute-via-telegram)
- [🔥 Example: Forging the Jumpstart Page (PR #267)](#-example-forging-the-jumpstart-page-pr-267)
- [Want Your Own Engine? (Advanced Setup)](#want-your-own-engine-advanced-setup)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Running Locally (Advanced)](#running-locally-advanced)
- [Configuration (Advanced)](#configuration-advanced)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Core Concepts](#core-concepts)
  - [Supervibe Studio (`/repo-xml`)](#supervibe-studio-repo-xml)
  - [SelfDev Philosophy (`/selfdev`)](#selfdev-philosophy-selfdev)
  - [Purpose & Profit (`/purpose-profit`)](#purpose--profit-purpose-profit)
  - [Security](#security)
- [Contributing](#contributing)
  - [✅ Easy Mode: Telegram + Supervibe Studio](#-easy-mode-telegram--supervibe-studio)
  - [⚙️ Advanced Mode: GitHub Workflow](#️-advanced-mode-github-workflow)
  - [Code Style](#code-style)
- [License](#license)
- [Contact](#contact)

</details>

---

## Disclaimer

oneSitePls and the VIBE methodology are under active development by Pavel Solovyov ([@salavey13](https://github.com/salavey13)). Expect rapid changes, potential bugs, and evolving features. This is an experimental approach pushing the boundaries of development workflows. Community feedback, bug reports, and contributions (especially via the Telegram workflow!) are highly encouraged!

---

## The VIBE Revolution

The traditional development cycle can be slow, frustrating, and often leads to building features nobody wants. In the AI era, the bottleneck isn't just writing code anymore – it's **directing the AI effectively, validating ideas quickly, and ensuring security and quality.**

oneSitePls tackles this head-on by:

1.  **Leveraging AI as a Co-Pilot:** AI (Gemini, Coze) assists with code generation, analysis, and even idea validation, freeing humans for strategic thinking.
2.  **Automating Tedious Tasks:** GitHub interactions (fetching code, creating PRs) are handled via the Supervibe Studio and server actions, reducing friction.
3.  **Democratizing Contribution:** **Anyone with Telegram** can suggest changes or improvements using the `/repo-xml` Mini App. No need to clone repos, install dependencies, or even have a GitHub account for basic contributions. Describe your idea, let AI help, and submit – Pavel reviews and merges.
4.  **Integrating Philosophy with Practice:** It's not just about *faster* code, but building the *right* things, aligned with personal growth and purpose (see `/selfdev`, `/purpose-profit`).
5.  **Prioritizing Security:** Building fast doesn't mean compromising security. VIBE includes checkpoints and emphasizes secure practices even with AI assistance (see `/about_en`).

### What is VIBE?

VIBE represents the core principles guiding oneSitePls development:

1.  **Validation:** Use AI and lean methods to test ideas *before* heavy investment. Fail fast, learn faster. (`/selfdev#validation`)
2.  **Iteration:** Leverage AI code generation (`/repo-xml`, Gemini/Coze) and automated workflows (Supervibe Studio, GitHub Actions, Telegram Bots) for rapid prototyping and feature deployment.
3.  **Business Logic & UX:** Free up human developers to architect robust systems, design intuitive user experiences, and implement complex business rules – areas where human insight excels.
4.  **Enhancement & Security:** Continuously improve the application and integrate security checks throughout the AI-assisted pipeline, ensuring speed doesn't compromise robustness.

---

## Key Features

-   💬 **Telegram-First Interface:** Contribute code ideas, fetch repo context, and trigger actions directly via the [@oneSitePlsBot](https://t.me/oneSitePlsBot) and its Mini App (`/repo-xml`).
-   🤖 **Supervibe Studio (`/repo-xml`):** The core Mini App for the AI workflow: fetch code, manage AI prompts, parse/validate AI responses, create/update GitHub PRs/branches.
-   🧠 **Deep AI Integration:** Utilize Google Gemini & Coze for code generation, analysis, and validation tasks (`/ai_actions`, `/selfdev#validation`).
-   🔒 **Integrated Security:** Automated workflow includes code parsing, validation hints, and secure GitHub operations. Security principles baked into the methodology (`/about_en`).
-   🔄 **Seamless GitHub Automation:** Server actions (`/actions_github`) handle repo fetching, branch/PR management, and user profile lookups via the GitHub API, triggered from the Mini App.
-   🌱 **SelfDev & Purpose Framework:** Pages (`/selfdev`, `/purpose-profit`) outlining a philosophy for thriving as a creator in the AI age.
-   🚀 **Jumpstart Concept (`/jumpstart`):** Vision for easily bootstrapping new projects based on VIBE principles.
-   ⚙️ **Modern Tech Stack:** Built with Next.js 14 (App Router), TypeScript, Supabase, Tailwind CSS, Shadcn/UI.
-   🔔 **Realtime Updates & Notifications:** Uses Supabase Realtime for AI response monitoring and Telegram bots for admin/user notifications.

---

## ⚡ The Supervibe Workflow (Contribute via Telegram!)

**This is the easiest way to contribute, even without coding experience!**

1.  **Open the Bot:** Go to [@oneSitePlsBot](https://t.me/oneSitePlsBot) in Telegram.
2.  **Launch the Studio:** Open the Mini App (often via a button in the chat or the attachment menu). Navigate to the **Supervibe Studio (`/repo-xml`)**.
3.  **Fetch Context (Optional but Recommended):**
    *   Use the "Settings" (<FaCodeBranch /> icon) to ensure the correct GitHub repo URL is set (defaults to `salavey13/carTest`).
    *   Click "Извлечь файлы" (`Fetch Files`) to load the current codebase into the "Кибер-Экстрактор".
    *   Select relevant files from the list to provide context for your idea.
4.  **Describe Your Task / Idea:** In the "Твой Запрос к AI" (`Your AI Request`) text area, clearly describe the change or feature you want.
    *   *(Optional)* Click "Добавить (+)" (`Add Selected`) to append the content of selected files to your request.
5.  **Get AI Assistance (Optional):**
    *   Click "🤖 Спросить AI" (`Ask AI`). Your request (with context) is sent to the backend AI (Gemini). *Pavel gets notified.*
    *   Wait for the AI response to appear in the "AI Code Assistant" text area below (this happens via Realtime).
    *   *(Alternative)* Copy the request (<FaCopy />) and paste it into your preferred AI (like AIStudio, ChatGPT, Grok, Qwen), then paste the *full AI response* back into the "AI Code Assistant" textarea.
6.  **Parse & Review:** Click the "➡️ Разобрать Ответ" (`Parse Response`) button next to the AI response textarea. The Studio will extract code blocks and identify files. Review the proposed changes.
7.  **Submit:** Select the files you want to include in the change. Add a descriptive "PR Title". Click "Создать PR" (`Create PR`) or "Обновить Ветку" (`Update Branch`).
8.  **Done!** A Pull Request is automatically created on the GitHub repository *on your behalf* (your Telegram @username might be mentioned for credit). Pavel gets notified to review and merge.

**That's it! You've contributed to a real-world project using AI and Telegram, potentially without writing a single line of code yourself or setting up any local development environment.**

---

## 🔥 Example: Forging the Jumpstart Page (PR #267)

**Curious what a VIBE session looks like?** Check out **[PR #267: Supervibe Jumpstart Playbook page](https://github.com/salavey13/carTest/pull/267)**!

This entire feature page (`/jumpstart/page.tsx`), built around the game-changing **'Product Maker Maker'** concept (giving users an *instant*, AI-powered business template!), was forged in a single **~5-hour VIBE session**.

**How it went down (see PR comments for the full dialogue):**

1.  **Concept Refinement:** A dynamic conversation between Pavel and the AI assistant (Gemini via AI Studio) honed the core idea – moving from just teaching to *giving* users a ready-to-go engine ("Pimp My Friend!").
2.  **AI Code Generation:** The AI generated the initial code structure, React components, and content based on the refined prompts.
3.  **Iteration & Debugging:** Pavel and the AI worked together to fix syntax errors, implement translations, refine UI elements, and ensure the code aligned with the VIBE philosophy.
4.  **Orchestration via Supervibe Studio:** While the AI dialogue happened externally (AI Studio), the process of fetching existing code, parsing AI responses, and ultimately submitting the changes (as 16 distinct commits!) was likely managed through the Supervibe Studio (`/repo-xml`) interface within Telegram.
5.  **Outcome:** A fully functional, visually polished, and merged feature page, ready for users.

**This PR perfectly demonstrates:**

-   **AI as a true co-pilot:** Assisting in conceptualization, coding, and refinement.
-   **Rapid Iteration:** Building and improving a complex feature in hours, not days.
-   **Human Oversight:** Pavel guiding the AI, reviewing code, and ensuring quality.
-   **The Power of the Telegram Workflow:** How complex changes can be orchestrated through a simple interface, making contribution accessible.

**This is the speed and collaborative power the VIBE workflow unlocks – a workflow *you* can participate in directly via Telegram!**

---

## Want Your Own Engine? (Advanced Setup)

If you want to fork this project, run it locally, customize it deeply, or deploy your own instance with your own tokens:

### Prerequisites

-   [Node.js](https://nodejs.org/) (v18+ recommended)
-   [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
-   [Git](https://git-scm.com/)
-   A Supabase account and project.
-   Your *own* Telegram Bot Token.
-   Your *own* API Keys for AI services (Gemini, Coze).
-   Your *own* GitHub Personal Access Token (`repo` scope).

### Installation

1.  **Clone:** `git clone https://github.com/salavey13/carTest.git && cd carTest`
2.  **Install:** `npm install` or `yarn install`
3.  **Environment:** Create `.env.local` from `.env.example` (if exists) or manually. See [Configuration (Advanced)](#configuration-advanced).
4.  **Supabase Setup:**
    *   Run necessary SQL migrations (check for a `/supabase/migrations` folder or examine `/types/database.types.ts` and `/hooks/supabase.ts` for table structures: `users`, `cars`, `invoices`, `ai_requests`, etc.).
    *   Set up Auth, Storage buckets (`carpix`, `about`, etc. - make public if needed), and potentially Edge Functions (`generate-embeddings`).
    *   Create required RPC functions (`search_cars`, `get_recent_paid_selfdev_invoices`, etc.). Find examples in `/hooks/supabase.ts` or `/app/selfdev/actions.ts`.

### Running Locally (Advanced)

```bash
npm run dev
# or
yarn dev
```

Access via `http://localhost:3000`. For full Telegram Mini App testing, use `ngrok` or deploy to a platform like Vercel and configure the bot's Mini App URL.

---

## Configuration (Advanced)

Create `.env.local` and fill these (replace placeholders):

```env
# Supabase (YOUR Project)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key # SERVER-SIDE ONLY

# Telegram (YOUR Bot)
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
ADMIN_CHAT_ID=your-telegram-admin-chat-id # YOUR Admin ID

# GitHub (YOUR Token)
GITHUB_TOKEN=ghp_yourgithubpersonalaccesstoken # Needs repo scope

# AI Services (YOUR Keys)
GEMINI_API_KEY=your-google-ai-gemini-api-key
COZE_API_KEY=your-coze-api-key
COZE_BOT_ID=your-coze-bot-id
COZE_USER_ID=your-coze-user-id

# Mock User (Optional, for dev outside Telegram)
NEXT_PUBLIC_USE_MOCK_USER=false
# ... (Mock user details if needed) ...

# Base URL (Needed for webhooks, links in notifications)
# Vercel sets NEXT_PUBLIC_VERCEL_URL automatically. Set manually otherwise.
# NEXT_PUBLIC_SITE_URL=https://your-deployment-url.com
```

**Security:** Protect your `.env.local` file and never commit sensitive keys.

---

## Technology Stack

-   **Framework:** [Next.js](https://nextjs.org/) (v14+ App Router)
-   **Language:** [TypeScript](https://www.typescriptlang.org/)
-   **Backend & DB:** [Supabase](https://supabase.io/) (Auth, Postgres, Storage, Realtime, Edge Functions?)
-   **Styling:** [Tailwind CSS](https://tailwindcss.com/) & [Shadcn/UI](https://ui.shadcn.com/)
-   **AI Models:** [Google Gemini](https://ai.google.dev/), [Coze AI](https://www.coze.com/)
-   **Platform:** [Telegram](https://telegram.org/) (Bot API, WebApp SDK)
-   **GitHub API:** [Octokit](https://github.com/octokit/octokit.js)
-   **State Management:** React Context API
-   **Linting/Formatting:** ESLint, Prettier

---

## Project Structure

```
/
├── app/                  # Next.js App Router Pages & Layouts
│   ├── (page_routes)/    # Route groups (e.g., about, donate, repo-xml)
│   │   ├── page.tsx      # Page component
│   │   └── actions.ts    # Server Actions specific to the route (optional)
│   ├── actions.ts        # General Server Actions (Telegram, DB, etc.)
│   ├── actions_github/   # Server Actions for GitHub API
│   │   └── actions.ts
│   ├── ai_actions/       # Server Actions for AI models
│   │   └── actions.ts
│   ├── webhook-handlers/ # Logic for Telegram payment webhooks
│   │   ├── *.ts
│   │   └── types.ts
│   ├── api/              # API Routes (e.g., /api/telegramWebhook)
│   ├── layout.tsx        # Root Layout
│   └── globals.css       # Global Styles
├── components/           # Shared React Components
│   ├── ui/               # Shadcn/UI components (likely generated)
│   ├── assistant_components/ # Components for AICodeAssistant
│   ├── repo/             # Components for RepoTxtFetcher
│   ├── stickyChat_components/ # Components for StickyChatButton/AutomationBuddy
│   └── *.tsx             # Other shared components (Header, Footer, etc.)
├── contexts/             # React Context Providers
│   ├── AppContext.tsx
│   └── RepoXmlPageContext.tsx
├── hooks/                # Custom React Hooks
│   ├── supabase.ts       # Supabase client setup & DB helpers
│   ├── useTelegram.ts    # Hook for Telegram WebApp interaction
│   └── *.ts              # Other custom hooks (e.g., useCodeParsing)
├── lib/                  # Utility functions, constants, types
│   ├── auth.ts           # JWT generation/verification
│   ├── logger.ts         # Logging utility
│   ├── utils.ts          # General utility functions (cn, getBaseUrl)
│   └── *.ts
├── public/               # Static assets
├── styles/               # Additional global styles (if needed)
├── types/                # TypeScript type definitions
│   ├── database.types.ts # Supabase generated types
│   ├── telegram.ts       # Telegram specific types
│   └── ai.types.ts       # AI request/response types
├── .env.local            # Local Environment Variables (DO NOT COMMIT)
├── .eslintrc.json        # ESLint configuration
├── next.config.mjs       # Next.js configuration
├── package.json          # Project dependencies and scripts
├── postcss.config.js     # PostCSS configuration
├── tailwind.config.ts    # Tailwind CSS configuration
├── tsconfig.json         # TypeScript configuration
└── README.md             # This file
```

---

## Core Concepts

### Supervibe Studio (`/repo-xml`)

The central Mini App for the AI-driven workflow. It allows users (via Telegram) to: Fetch GitHub code → Select context → Describe task → Interact with AI (submit request, receive response via Realtime) → Parse & Validate AI output → Create/Update GitHub PRs/Branches. **This makes GitHub contribution accessible without local setup.**

### SelfDev Philosophy (`/selfdev`)

Explores the mindset shift required in the AI era: becoming an **authentic creator/generalist**, leveraging AI, **validating ideas fast**, and building purpose-driven ventures. Connects deeply with the VIBE methodology.

### Purpose & Profit (`/purpose-profit`)

Summarizes key ideas (inspired by Dan Koe) on **integrating personal purpose with practical business building**. Covers mental models for value, the "Deep Generalism" concept, and the "Self-Monetization" approach (being your own niche).

### Security

A core tenet of VIBE. While AI accelerates development, security isn't sacrificed:

-   **Secure GitHub Flow:** Controlled via backend actions and tokens.
-   **AI Code Review:** Parsing/validation steps in the Studio encourage human review.
-   **Secure Configuration:** Sensitive keys managed via environment variables.
-   **Supabase RLS:** Essential for data protection.


### Pull Requests

-   Provide a clear title and description for your PR, explaining the "what" and "why" of your changes.
-   Link to any relevant issues.
-   Ensure all CI checks (linting, type checking, tests) pass.
-   Be responsive to feedback from maintainers.

### Code Style

-   Follow the existing code style enforced by ESLint and Prettier.
-   Use TypeScript for type safety.
-   Write clear, maintainable, and well-documented code where necessary.

---

## License

This project is licensed under the **Apache-2.0 License**. See the [LICENSE](LICENSE) file for details.

---

## Contact

Pavel Solovyov (salavey13)

-   **GitHub:** [https://github.com/salavey13](https://github.com/salavey13)
-   **Telegram:** [@salavey13](https://t.me/salavey13)
-   **Email:** [salavey13@gmail.com](mailto:salavey13@gmail.com)

Feel free to reach out with questions, feedback, or collaboration ideas!

---
```
