# oneSitePls: The AI-Powered VIBE Engine for Telegram-Driven Development 🚀

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-^5-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-^14-black?logo=next.js&logoColor=white)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-^2-3ECF8E?logo=supabase&logoColor=white)](https://supabase.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-^3-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Telegram](https://img.shields.io/badge/Telegram-Bot%20%26%20Mini%20App-blue?logo=telegram)](https://t.me/oneSitePlsBot)

**Build, Validate, and Launch Secure Web Apps at Lightspeed with AI & Telegram – Contribute Without a Local Setup!**

oneSitePls is more than a framework; it's a **new approach to development**, built on the **VIBE methodology**. Developed by Pavel Solovyov ([@salavey13](https://github.com/salavey13)), it streamlines web development by deeply integrating AI (Gemini, Coze) and using **Telegram** as the central hub for contribution and project interaction.

**Forget complex local setups and Git commands for many contributions.** Anyone with a Telegram account can suggest ideas, propose changes, and even generate code with AI assistance, directly through the [@oneSitePlsBot](https://t.me/oneSitePlsBot) and its embedded **Supervibe Studio** Mini App (`/repo-xml` command).

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
- [🚀 Contribute Easily via Telegram!](#-contribute-easily-via-telegram)
- [🔥 See VIBE in Action: The Jumpstart Page (PR #267)](#-see-vibe-in-action-the-jumpstart-page-pr-267)
- [Want Your Own Engine? (Advanced Setup)](#want-your-own-engine-advanced-setup)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Running Locally](#running-locally)
  - [Configuration](#configuration)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Core Concepts](#core-concepts)
  - [Supervibe Studio (`/repo-xml`)](#supervibe-studio-repo-xml)
  - [SelfDev Philosophy (`/selfdev`)](#selfdev-philosophy-selfdev)
  - [Purpose & Profit (`/purpose-profit`)](#purpose--profit-purpose-profit)
  - [Security](#security)
- [Contributing](#contributing)
  - [✅ The Easy Way: Telegram + Supervibe Studio](#-the-easy-way-telegram--supervibe-studio)
  - [⚙️ The Advanced Way: Standard GitHub Workflow](#️-the-advanced-way-standard-github-workflow)
- [License](#license)
- [Contact](#contact)

</details>

---

## Disclaimer

oneSitePls and the VIBE methodology are under active development by Pavel Solovyov ([@salavey13](https://github.com/salavey13)). Expect rapid changes, potential bugs, and evolving features. This is an experimental approach exploring new development workflows. Community feedback, bug reports, and contributions (especially via the easy Telegram method!) are highly encouraged!

---

## The VIBE Revolution

Traditional development can be slow and disconnected from real needs. In the age of AI, the challenge shifts from just *writing* code to **effectively directing AI, validating ideas quickly, and maintaining quality and security.**

oneSitePls addresses this by:

1.  **Using AI as a Co-Pilot:** AI (Gemini, Coze) assists with code generation, analysis, and idea validation, freeing humans for higher-level strategy.
2.  **Automating Tedium:** GitHub interactions (fetching code, creating PRs) are handled via the Supervibe Studio and backend actions, reducing friction.
3.  **Democratizing Contribution:** **Anyone with Telegram** can suggest changes or improvements using the `/repo-xml` Mini App. No need to clone repos, install dependencies, or use Git for many tasks. Just describe your idea, get AI help (optional), and submit – Pavel reviews and integrates.
4.  **Integrating Philosophy:** It's not just about *faster* code, but building *meaningful* products aligned with personal growth and purpose (see `/selfdev`, `/purpose-profit`).
5.  **Prioritizing Security:** Building fast doesn't mean compromising safety. VIBE emphasizes secure practices even within the AI-assisted workflow (see `/about_en`).

### What is VIBE?

VIBE guides the oneSitePls development approach:

1.  **Validation:** Use AI and lean methods to test ideas *before* heavy investment. Fail fast, learn faster. (`/selfdev#validation`)
2.  **Iteration:** Leverage AI code generation (`/repo-xml`, Gemini/Coze) and automated workflows (Supervibe Studio, GitHub Actions, Telegram Bots) for rapid prototyping and deployment.
3.  **Business Logic & UX:** Focus human developers on architecting robust systems, designing intuitive interfaces, and implementing complex business rules – areas where human insight shines.
4.  **Enhancement & Security:** Continuously improve the application and integrate security checks throughout the pipeline, ensuring speed doesn't compromise robustness.

---

## Key Features

-   💬 **Telegram-First Interface:** Interact with the project, suggest changes, and trigger actions via [@oneSitePlsBot](https://t.me/oneSitePlsBot) and its Mini App (`/repo-xml`).
-   🤖 **Supervibe Studio (`/repo-xml`):** The core Mini App for the AI workflow: fetch code, manage AI prompts, parse AI responses, create/update GitHub PRs/branches directly from Telegram.
-   🧠 **Deep AI Integration:** Utilizes Google Gemini & Coze for code generation, analysis, and validation (`/ai_actions`, `/selfdev#validation`).
-   🔒 **Integrated Security:** Automated workflow includes code parsing, validation hints, and secure backend GitHub operations. Security principles are part of the methodology (`/about_en`).
-   🔄 **Seamless GitHub Automation:** Backend actions (`/actions_github`) handle repo fetching, branch/PR management, triggered from the Mini App.
-   🌱 **SelfDev & Purpose Framework:** Pages (`/selfdev`, `/purpose-profit`) outlining a philosophy for thriving as a creator in the AI age.
-   🚀 **Jumpstart Concept (`/jumpstart`):** Vision for easily bootstrapping new projects based on VIBE principles.
-   ⚙️ **Modern Tech Stack:** Built with Next.js 14 (App Router), TypeScript, Supabase, Tailwind CSS, Shadcn/UI.
-   🔔 **Realtime Updates & Notifications:** Uses Supabase Realtime for monitoring AI tasks and Telegram bots for notifications.

---

## 🚀 Contribute Easily via Telegram!

**This is the simplest way to contribute, perfect even if you're not a coder or don't want to set up a local development environment.**

1.  **Open the Bot:** Start a chat with [@oneSitePlsBot](https://t.me/oneSitePlsBot) in Telegram.
2.  **Launch the Studio:** Open the Mini App (usually via a button in the chat or the attachment menu / slash command). Navigate to the **Supervibe Studio (`/repo-xml`)**.
3.  **Fetch Code (Optional but helpful):**
    *   Use "Settings" (<FaCodeBranch /> icon) to ensure the correct GitHub repo is targeted (defaults to `salavey13/carTest`).
    *   Click "Извлечь файлы" (`Fetch Files`) to load the current codebase structure.
    *   Select relevant files from the list to give the AI (and Pavel) context for your suggestion.
4.  **Describe Your Idea:** In the "Твой Запрос к AI" (`Your AI Request`) box, clearly explain the change, feature, or improvement you have in mind. Be specific!
    *   *(Optional)* Click "Добавить (+)" (`Add Selected`) to include the content of selected files in your request for better AI context.
5.  **Get AI Help (Optional):**
    *   Click "🤖 Спросить AI" (`Ask AI`). Your request (and any selected file context) is sent to the backend AI (Gemini). *Pavel gets notified.*
    *   Wait for the AI's suggested code/text to appear in the "AI Code Assistant" box below (this uses Realtime, so it updates automatically).
    *   *(Alternative)* You can copy the request (<FaCopy />), use your own AI tool (like ChatGPT, Claude, etc.), and then paste the *full AI response* back into the "AI Code Assistant" box.
6.  **Review & Prepare:** Click "➡️ Разобрать Ответ" (`Parse Response`) next to the AI response. The tool extracts code blocks and identifies files. Review the changes. Does it match your idea?
7.  **Submit:** Select the files you want included. Add a descriptive "PR Title" (e.g., "Fix typo on about page", "Add new feature description"). Click "Создать PR" (`Create PR`) or "Обновить Ветку" (`Update Branch`).
8.  **Done!** A Pull Request is automatically created on the GitHub repository. Pavel gets notified to review, discuss (if needed), and merge your contribution. Your Telegram username might be mentioned for credit.

**That's it! You've contributed to a real project using AI and Telegram, potentially without writing code yourself or touching Git.**

---

## 🔥 See VIBE in Action: The Jumpstart Page (PR #267)

**Want proof of concept?** Check out **[PR #267: Supervibe Jumpstart Playbook page](https://github.com/salavey13/carTest/pull/267)**!

This entire feature page (`/jumpstart`), built around the innovative **'Product Maker Maker'** concept (giving users an instant, AI-powered business template!), was created in a single **~5-hour VIBE session**.

**How it happened (see PR comments for details):**

1.  **Concept Refinement:** Dialogue between Pavel and AI (Gemini via AI Studio) refined the idea.
2.  **AI Code Generation:** AI generated initial React components, structure, and content.
3.  **Iteration & Debugging:** Pavel and AI worked together to fix errors, refine UI, and ensure alignment.
4.  **Orchestration:** The Supervibe Studio (`/repo-xml`) in Telegram was likely used to manage fetching code, parsing AI responses, and submitting the changes across 16 commits.
5.  **Outcome:** A merged, functional, polished feature page.

**This PR perfectly demonstrates:**

-   **AI as a collaborator:** Assisting in ideation, coding, and refinement.
-   **Rapid Iteration:** Building a significant feature in hours.
-   **Human Oversight:** Pavel guiding the process, reviewing, and ensuring quality.
-   **The Power of the Telegram Workflow:** Orchestrating complex changes through a user-friendly interface.

**This is the speed and collaboration the VIBE workflow enables – a workflow *you* can easily participate in!**

---

## Want Your Own Engine? (Advanced Setup)

This section is for developers who want to fork the project, run it locally, deploy their own instance, or contribute via the traditional Git workflow.

### Prerequisites

-   [Node.js](https://nodejs.org/) (v18+ recommended)
-   [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
-   [Git](https://git-scm.com/)
-   A Supabase account and project.
-   Your *own* Telegram Bot Token.
-   Your *own* API Keys for AI services (Google AI Studio/Gemini, Coze).
-   Your *own* GitHub Personal Access Token (classic or fine-grained with `repo` scope).

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/salavey13/carTest.git
    cd carTest
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    # or
    yarn install
    ```
3.  **Set up environment variables:**
    *   Create a `.env.local` file in the root directory by copying `.env.example` (if it exists) or creating it manually.
    *   Fill in the required values as described in the [Configuration](#configuration) section below using *your own keys and project details*.
4.  **Set up Supabase:**
    *   In your Supabase project, run the necessary SQL migrations. Check the `/supabase/migrations` folder (if present) or examine `/types/database.types.ts` and database interactions (e.g., in `/hooks/supabase.ts`, `/app/**/actions.ts`) to understand the required tables (e.g., `users`, `ai_requests`, `invoices`, etc.). You might need to create these manually if migrations aren't provided.
    *   Configure Supabase Auth settings.
    *   Set up required Storage buckets (e.g., `carpix`, `about` - check code for usage) and configure their policies (e.g., public access if needed).
    *   Create required database functions (RPC) if used (e.g., `search_cars`, `get_recent_paid_selfdev_invoices`). Check `/hooks/supabase.ts` or `/app/**/actions.ts` for function calls.
    *   Enable Row Level Security (RLS) on your tables and define appropriate policies for security.

### Running Locally

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

**Note:** For full Telegram Mini App functionality testing (including receiving user data from Telegram), you'll need to:
1.  Deploy your local instance to the web using a tunneling service like `ngrok`.
2.  Configure your Telegram Bot's Mini App URL (via [@BotFather](https://t.me/BotFather)) to point to your `ngrok` HTTPS URL.

### Configuration

Create a `.env.local` file in the project root and add the following variables with *your own credentials*. **Never commit this file to Git.**

```env
# Supabase (YOUR Project Credentials)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key # Used server-side only

# Telegram (YOUR Bot Credentials)
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
ADMIN_CHAT_ID=your_personal_telegram_chat_id # For receiving admin notifications

# GitHub (YOUR Personal Access Token)
# Needs 'repo' scope for accessing repositories
GITHUB_TOKEN=ghp_yourgithubpersonalaccesstoken

# AI Services (YOUR API Keys)
GEMINI_API_KEY=your_google_ai_studio_or_gemini_api_key
# COZE_API_KEY=your_coze_api_key # Add if using Coze
# COZE_BOT_ID=your_coze_bot_id
# COZE_USER_ID=your_coze_user_id # Usually '29032...'

# Deployment URL (Required for Webhooks, Links in messages)
# Vercel automatically sets NEXT_PUBLIC_VERCEL_URL.
# If deploying elsewhere, set NEXT_PUBLIC_SITE_URL.
# Example: NEXT_PUBLIC_SITE_URL=https://your-app-domain.com

# Mock User (Optional: For development outside Telegram environment)
# Set to true to simulate a Telegram user without the actual WebApp context
# NEXT_PUBLIC_USE_MOCK_USER=false
# MOCK_USER_DETAILS='{"id":123456,"first_name":"Mock","last_name":"User","username":"mockuser","language_code":"en"}' # Example
```

**Security Reminder:** Keep your `.env.local` file secure and out of version control.

---

## Technology Stack

-   **Framework:** [Next.js](https://nextjs.org/) (v14+ App Router)
-   **Language:** [TypeScript](https://www.typescriptlang.org/)
-   **Backend & DB:** [Supabase](https://supabase.io/) (Auth, Postgres DB, Storage, Realtime)
-   **Styling:** [Tailwind CSS](https://tailwindcss.com/)
-   **UI Components:** [Shadcn/UI](https://ui.shadcn.com/)
-   **AI Models:** [Google Gemini](https://ai.google.dev/), [Coze AI](https://www.coze.com/) (via API)
-   **Platform Integration:** [Telegram Bot API](https://core.telegram.org/bots/api), [Telegram WebApp SDK](https://core.telegram.org/bots/webapps)
-   **GitHub Interaction:** [Octokit](https://github.com/octokit/octokit.js) (via GitHub API)
-   **State Management:** React Context API, Server Actions
-   **Linting/Formatting:** ESLint, Prettier

---

## Project Structure

```
/
├── app/                  # Next.js App Router: Pages, Layouts, Server Actions
│   ├── (page_routes)/    # Feature-specific route groups (e.g., repo-xml, selfdev)
│   │   ├── page.tsx      # Page component for the route
│   │   └── actions.ts    # Server Actions specific to this route (optional)
│   ├── actions.ts        # General Server Actions (e.g., DB interactions)
│   ├── actions_github/   # Server Actions dedicated to GitHub API calls
│   │   └── actions.ts
│   ├── ai_actions/       # Server Actions for interacting with AI models
│   │   └── actions.ts
│   ├── api/              # API Routes (e.g., /api/telegramWebhook for bot updates)
│   ├── webhook-handlers/ # Logic for specific webhooks (e.g., Telegram payments)
│   ├── layout.tsx        # Root application layout
│   └── globals.css       # Global styles
├── components/           # Reusable React components
│   ├── ui/               # Shadcn/UI components (often generated)
│   ├── assistant_components/ # Components used in the AI Assistant UI
│   ├── repo/             # Components for the Supervibe Studio (`/repo-xml`)
│   └── *.tsx             # Other shared components (Header, Footer, etc.)
├── contexts/             # React Context providers for global state
│   ├── AppContext.tsx
│   └── RepoXmlPageContext.tsx
├── hooks/                # Custom React Hooks
│   ├── supabase.ts       # Supabase client setup & helper functions
│   ├── useTelegram.ts    # Hook for interacting with Telegram WebApp SDK
│   └── *.ts              # Other custom hooks
├── lib/                  # Utility functions, constants, shared types
│   ├── auth.ts           # Authentication related utilities (if any)
│   ├── logger.ts         # Logging setup
│   ├── utils.ts          # General utility functions (e.g., cn, getBaseUrl)
│   └── *.ts
├── public/               # Static assets (images, fonts, etc.)
├── styles/               # Additional global styles if needed
├── types/                # TypeScript type definitions
│   ├── database.types.ts # Auto-generated Supabase types (important!)
│   ├── telegram.ts       # Types related to Telegram API/WebApp
│   └── ai.types.ts       # Types for AI request/response structures
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

This is the Telegram Mini App that powers the easy contribution workflow. It enables users to: Fetch GitHub code context → Describe a task → Interact with AI (send prompt, receive code/text via Realtime) → Parse AI output → Validate changes → Create/Update GitHub Pull Requests or Branches. **It makes contributing accessible without needing Git or a local setup.**

### SelfDev Philosophy (`/selfdev`)

Explores the mindset for creators in the AI era: leveraging AI effectively, validating ideas rapidly, focusing on unique strengths, and building purpose-driven projects. This philosophy underpins the VIBE methodology.

### Purpose & Profit (`/purpose-profit`)

Draws inspiration (e.g., from Dan Koe) on aligning personal purpose with building valuable products/services. Touches on concepts like "Deep Generalism" and sustainable monetization strategies.

### Security

Security is integral to the VIBE approach:

-   **Secure GitHub Operations:** Handled via backend server actions using protected tokens.
-   **AI Output Review:** The Supervibe Studio's parsing and validation steps encourage human review before submission.
-   **Secure Configuration:** Sensitive API keys and credentials managed via environment variables (`.env.local`) and not exposed client-side unless necessary (and safe).
-   **Supabase RLS:** Row Level Security should be configured in Supabase to protect data access.

---

## Contributing

We welcome contributions of all kinds! Here are the main ways to contribute:

### ✅ The Easy Way: Telegram + Supervibe Studio

-   **Ideal for:** Suggesting features, reporting bugs, proposing text changes, simple code adjustments, or generating code ideas with AI assistance.
-   **How:** Use the [@oneSitePlsBot](https://t.me/oneSitePlsBot) and its `/repo-xml` Mini App (Supervibe Studio) as described in the [🚀 Contribute Easily via Telegram!](#-contribute-easily-via-telegram) section above.
-   **No local setup or Git knowledge required!**

### ⚙️ The Advanced Way: Standard GitHub Workflow

-   **Ideal for:** More complex features, bug fixes requiring local debugging, refactoring, dependency updates, or for those comfortable with Git and GitHub.
-   **How:**
    1.  **Fork** the repository on GitHub.
    2.  **Clone** your fork locally: `git clone https://github.com/YOUR_USERNAME/carTest.git`
    3.  **Create a new branch** for your changes: `git checkout -b feature/your-feature-name` or `fix/issue-description`.
    4.  **Make your changes:** Write code, fix bugs, add tests.
    5.  **Commit** your changes with clear, descriptive messages: `git commit -m "feat: Add new login method"`
    6.  **Push** your branch to your fork: `git push origin feature/your-feature-name`
    7.  **Open a Pull Request (PR)** from your branch on your fork to the `main` branch of the original `salavey13/carTest` repository.
    8.  **Describe your PR:** Clearly explain the purpose of your changes and link any relevant issues (e.g., `Fixes #123`).
    9.  **Ensure Checks Pass:** Make sure any automated checks (linting, tests, builds) configured for the repository pass.
    10. **Respond to Feedback:** Engage in discussion and address any feedback from maintainers.

-   **Code Style:** Please follow the existing code style, enforced by ESLint and Prettier. Run `npm run lint` and `npm run format` (or equivalent `yarn` commands) before committing. Use TypeScript effectively. Write clear, maintainable code.

---

## License

This project is licensed under the **Apache-2.0 License**. See the [LICENSE](LICENSE) file for details.

---

## Contact

Pavel Solovyov (salavey13)

-   **GitHub:** [https://github.com/salavey13](https://github.com/salavey13)
-   **Telegram:** [@salavey13](https://t.me/salavey13)
-   **Project Bot:** [@oneSitePlsBot](https://t.me/oneSitePlsBot)
-   **Email:** [salavey13@gmail.com](mailto:salavey13@gmail.com)

Feel free to reach out with questions, feedback, or collaboration ideas!

---
