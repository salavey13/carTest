# oneSitePls: AI-Powered VIBE Development Platform

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-^5-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-^14-black?logo=next.js&logoColor=white)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-^2-3ECF8E?logo=supabase&logoColor=white)](https://supabase.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-^3-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

**Build, Validate, and Launch Modern Web Applications Faster with AI-Assisted Workflows.**

oneSitePls is a comprehensive platform and methodology (`VIBE`) designed to accelerate secure web development by leveraging AI as a core component. It integrates AI-assisted coding, validation, and deployment pipelines, enabling developers (especially solo founders or small teams) to focus on high-level architecture, user experience, and business logic while automating repetitive tasks.

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
- [Overview](#overview)
  - [The VIBE Methodology](#the-vibe-methodology)
- [Key Features](#key-features)
- [Technology Stack](#technology-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Running Locally](#running-locally)
- [Configuration](#configuration)
- [Project Structure](#project-structure)
- [Core Concepts](#core-concepts)
  - [AI-Assisted Workflow (`/repo-xml`)](#ai-assisted-workflow-repo-xml)
  - [SelfDev Philosophy (`/selfdev`)](#selfdev-philosophy-selfdev)
  - [Purpose & Profit (`/purpose-profit`)](#purpose--profit-purpose-profit)
  - [Security](#security)
- [Contributing](#contributing)
  - [Development Workflow](#development-workflow)
  - [Pull Requests](#pull-requests)
  - [Code Style](#code-style)
- [License](#license)
- [Contact](#contact)

</details>

---

## Disclaimer

oneSitePls and the VIBE methodology are under active development by Pavel Solovyov ([@salavey13](https://github.com/salavey13)). Expect rapid changes, potential bugs, and evolving features. Community feedback, bug reports, and contributions are highly welcome!

---

## Overview

In the age of powerful AI models, the bottleneck in development is shifting from writing lines of code to ensuring we build the *right* things, securely and efficiently. oneSitePls provides both the tools and the mindset (`VIBE`) to navigate this new landscape.

It's built for developers who want to:

-   Utilize AI (like Gemini, Coze) not just for code generation, but for the entire development lifecycle, including validation.
-   Automate interactions with platforms like GitHub via tools like the **Supervibe Studio** (`/repo-xml`).
-   Integrate development practices with personal growth and purpose-driven goals (inspired by `/selfdev` and `/purpose-profit`).
-   Maintain a strong focus on security, even when leveraging AI for speed.
-   Use a modern, robust tech stack (Next.js, Supabase, TypeScript).

### The VIBE Methodology

VIBE stands for **Validation, Iteration, Business Logic, Enhancement** (or similar interpretation based on usage). It emphasizes:

1.  **Validation:** Using AI and lean methods to test ideas *before* heavy investment (`/selfdev#validation`). Fail fast, learn faster.
2.  **Iteration:** Leveraging AI code generation (`/repo-xml`, potentially Gemini/Coze) and automated workflows (GitHub Actions, Telegram Bots) for rapid prototyping and feature development.
3.  **Business Logic & UX:** Freeing up human developers to focus on the core value proposition, complex logic, and user experience, where human insight is crucial.
4.  **Enhancement & Security:** Continuously improving the application and integrating security checks throughout the AI-assisted pipeline.

---

## Key Features

-   🤖 **Supervibe Studio (`/repo-xml`):** An integrated interface to fetch repository code, interact with AI assistants (like Gemini via `ai_actions`), parse responses, validate code, and create/update GitHub Pull Requests or branches directly.
-   🧠 **AI Integration:** Support for Google Gemini and Coze AI models for code generation, analysis, and potentially other tasks (e.g., text analysis, validation).
-   🔒 **Secure Development Focus:** Emphasis on secure coding practices, automated checks (OWASP, SAST concepts mentioned), and secure workflows, even with AI-generated code. See `/about_en`.
-   🔄 **GitHub Automation:** Server actions (`actions_github`) to fetch repo contents, create/update branches, manage PRs (create, merge, close, list, approve), and delete branches via the GitHub API.
-   💬 **Telegram Integration:** Built as a Telegram Mini App, leveraging user authentication, bot interactions (notifications, commands), and potentially payments (Telegram Stars via `webhook-handlers`).
-   🌱 **SelfDev & Purpose:** Dedicated sections (`/selfdev`, `/purpose-profit`) exploring philosophies for personal and professional growth in the AI era, integrating purpose with profit.
-   🚀 **Jumpstart Kit Concept (`/jumpstart`):** A potential feature offering a quick-start template based on the oneSitePls principles.
-   📄 **Dynamic Content Pages:** Includes pages like `/about`, `/donate`, `/purpose-profit` built with Next.js and Shadcn/UI.
-   ⚙️ **Context Management:** Robust state management using React Context (`AppContext`, `RepoXmlPageContext`).
-   🎣 **Supabase Backend:** Leverages Supabase for Authentication, Database (Postgres), Storage, and potentially Edge Functions (e.g., for embeddings).

---

## Technology Stack

-   **Framework:** [Next.js](https://nextjs.org/) (v14+ App Router)
-   **Language:** [TypeScript](https://www.typescriptlang.org/)
-   **Backend & DB:** [Supabase](https://supabase.io/) (Auth, Postgres, Storage, Edge Functions?)
-   **Styling:** [Tailwind CSS](https://tailwindcss.com/) & [Shadcn/UI](https://ui.shadcn.com/)
-   **AI Models:** [Google Gemini](https://ai.google.dev/), [Coze AI](https://www.coze.com/)
-   **GitHub API:** [Octokit](https://github.com/octokit/octokit.js)
-   **Telegram:** WebApp JS SDK, Bot API
-   **State Management:** React Context API
-   **Linting/Formatting:** ESLint, Prettier
-   **Testing:** (Assumed setup, e.g., Vitest/Jest)

---

## Getting Started

### Prerequisites

-   [Node.js](https://nodejs.org/) (v18 or newer recommended, check `engines` in `package.json`)
-   [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
-   [Git](https://git-scm.com/)
-   A Supabase account and project.
-   A Telegram Bot Token.
-   API Keys for OpenAI/Gemini and/or Coze AI.
-   A GitHub Personal Access Token (classic or fine-grained) with `repo` scope.

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/salavey13/carTest.git # Or your repo URL
    cd carTest
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    # or
    yarn install
    ```

3.  **Set up environment variables:**
    Create a `.env.local` file in the root directory by copying `.env.example` (if one exists) or creating it from scratch. Fill in the required values (see [Configuration](#configuration) section below).

    ```bash
    cp .env.example .env.local # If example exists
    # nano .env.local # Then edit the file
    ```

4.  **Set up Supabase:**
    - Ensure your Supabase project database schema matches the types defined in `/types/database.types.ts`. You might need to run SQL migrations provided in the project (if any) or set up tables manually based on the code's usage (`users`, `cars`, `invoices`, `rentals`, `ai_requests`, etc.).
    - Configure Supabase authentication settings if needed.
    - Set up Storage buckets (`carpix`, `about`, `character-images`, etc.) and ensure appropriate access policies (e.g., public read for image buckets).
    - Deploy Supabase Edge Functions if used (e.g., `generate-embeddings`).
    - Ensure necessary RPC functions (`search_cars`, `similar_cars`, `get_recent_paid_selfdev_invoices`) are created in your Supabase SQL editor.

### Running Locally

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. For Telegram Mini App features, you'll need to run it within the Telegram client using a tool like `ngrok` or deploying it.

---

## Configuration

Create a `.env.local` file in the project root and add the following variables:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key # Keep secure, only for backend/server actions!

# Telegram
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
ADMIN_CHAT_ID=your-telegram-admin-chat-id # Your personal Telegram user ID for admin notifications

# GitHub
GITHUB_TOKEN=ghp_yourgithubpersonalaccesstoken # Needs repo scope

# AI Services
GEMINI_API_KEY=your-google-ai-gemini-api-key # Optional: For Google Gemini features
COZE_API_KEY=your-coze-api-key # Optional: For Coze AI features
COZE_BOT_ID=your-coze-bot-id-for-analysis # Optional: Specific Coze bot for message analysis
COZE_USER_ID=your-coze-user-id-for-analysis # Optional: User ID associated with Coze bot

# Mock User (for development outside Telegram) - Set to 'true' to enable
NEXT_PUBLIC_USE_MOCK_USER=false # Set to true for local dev without Telegram
NEXT_PUBLIC_MOCK_USER_ID=413553377
NEXT_PUBLIC_MOCK_USER_FIRST_NAME=Mock
NEXT_PUBLIC_MOCK_USER_LAST_NAME=User
NEXT_PUBLIC_MOCK_USER_USERNAME=mockuser
NEXT_PUBLIC_MOCK_USER_LANG=ru
NEXT_PUBLIC_MOCK_USER_PHOTO=https://... # Optional photo URL

# Base URL (for generating absolute URLs in notifications/webhooks)
# Vercel automatically sets VERCEL_URL / NEXT_PUBLIC_VERCEL_URL
# Set manually for other environments or local dev with ngrok
# NEXT_PUBLIC_SITE_URL=http://localhost:3000 or your production URL
```

**IMPORTANT:** Never commit your `.env.local` file or expose sensitive keys (like `SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_BOT_TOKEN`, `GITHUB_TOKEN`, AI keys) publicly.

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

### AI-Assisted Workflow (`/repo-xml`)

The **Supervibe Studio** is the central hub for the AI-driven workflow. It allows you:

1.  **Fetch Code:** Extract code from a GitHub repository branch or PR.
2.  **Select Context:** Choose specific files to provide as context to the AI.
3.  **Generate Prompt:** Write a task description for the AI, optionally adding selected code context.
4.  **Interact with AI:** Send the request to a configured AI model (like Gemini) via backend actions. The platform listens for responses via Supabase Realtime.
5.  **Parse & Validate:** Automatically parse the AI's code response, identifying files and validating structure.
6.  **Review & Refine:** Examine the generated/modified code, utilize built-in tools (search/replace), and potentially auto-fix simple validation issues.
7.  **Commit/PR:** Create a new GitHub Pull Request or update an existing branch with the selected, validated changes.

### SelfDev Philosophy (`/selfdev`)

This section (and related page) explores the mindset behind oneSitePls. It focuses on:

-   Shifting from traditional employment models to becoming an **authentic creator/entrepreneur**.
-   Using **AI as a lever** to amplify individual capabilities ("Solo Founder 2.0").
-   **Validating ideas rapidly** using AI before extensive development.
-   Learning through **imitation and iteration**.
-   Building a business around solving **your own problems first**.
-   See also `/about_en` for the VIBE methodology connection.

### Purpose & Profit (`/purpose-profit`)

This page summarizes key ideas (inspired by Dan Koe's work) about integrating personal purpose with the practical need for profit. It discusses:

-   Mental models for work, money, and value creation.
-   The concept of "Deep Generalism" vs. specialization.
-   Levels of purpose and finding your "Life's Work".
-   The importance of writing and communication as meta-skills.
-   The "Self-Monetization" model.

### Security

Security is a primary consideration, especially when integrating AI:

-   **Secure GitHub Flow:** Uses GitHub tokens with appropriate permissions, automates PR creation/updates.
-   **AI Code Review (Conceptual):** While not fully automated, the `/repo-xml` parsing and validation step encourages review before committing AI code. The VIBE methodology described in `/about_en` emphasizes human oversight on security.
-   **Environment Variable Management:** Critical keys are managed via `.env.local` and should not be committed.
-   **Supabase RLS:** Row Level Security should be configured in Supabase to protect data access, especially for user-specific information.
-   **Admin Client Usage:** The `supabaseAdmin` client is used only in server-side actions (`/app/actions*`) and never exposed client-side.

---

## Contributing

Contributions are welcome! Please follow these guidelines:

### Development Workflow

1.  **Fork the repository** and clone it locally.
2.  **Create a feature branch:** `git checkout -b feat/your-feature-name` or `fix/your-bug-fix`.
3.  **Install dependencies:** `npm install` or `yarn install`.
4.  **Set up your `.env.local` file** as described in the [Configuration](#configuration) section.
5.  **Make your changes.** Ensure code is well-formatted and adheres to project conventions.
6.  **Add tests** for new features or bug fixes (if applicable).
7.  **Run checks locally:**
    ```bash
    npm run lint # Check for linting errors
    npm run typecheck # Check for TypeScript errors
    # npm run test # Run tests (if configured)
    ```
8.  **Commit your changes** with clear, descriptive messages.
9.  **Push your branch** to your fork: `git push origin feat/your-feature-name`.
10. **Open a Pull Request** against the `main` branch of the original repository.

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
