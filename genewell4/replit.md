# Genewell - Wellness AI Platform

## Overview
Genewell is a personalized wellness blueprint platform designed to provide tailored health and wellness guidance. It operates with two primary systems: a React/Express application serving as the main user interface and administrative dashboard, and a Django application dedicated to generating comprehensive wellness reports in PDF format. The platform aims to offer personalized wellness blueprints, integrate AI for narrative generation and meal planning, and provide a seamless user experience for health assessments and personalized reports. The vision is to empower individuals with actionable insights for better health management through advanced technology and personalized content.

## User Preferences
I prefer clear, concise communication. When making changes, please outline the proposed modifications and their impact before execution. I value iterative development and expect the agent to ask clarifying questions as needed.

## System Architecture

### React/Express Application (Port 5000)
- **Frontend**: React 18 with TypeScript, Tailwind CSS, Radix UI components, and React Router.
- **Backend**: Express.js, integrated as Vite middleware in development.
- **Database**: PostgreSQL, accessible via `DATABASE_URL`.
- **AI Integration**: OpenAI via Replit AI Integrations (gpt-5-mini for narrative generation).
- **Build Tool**: Vite 6.
- **Language**: TypeScript.
- **PDF Generation**: Client-side jsPDF, incorporating server-side AI-generated narratives and meal plans.
- **Payment**: Instamojo payment gateway.
- **Admin System**: Comprehensive admin dashboard with user management, quiz data, purchases, downloads, traffic analysis, and product management. Includes bot detection, Excel exports, and optional Gmail SMTP for emails.
- **SEO**: Implemented with meta tags, Open Graph, Twitter Cards, JSON-LD structured data, sitemap.xml, and robots.txt.
- **UI/UX**: Responsive design with mobile optimizations (e.g., hamburger menus, icon-only buttons). Color schemes and typography are managed via Tailwind CSS and Radix UI components for a modern aesthetic.

### Django Application (Port 8000)
- **Framework**: Django 5.2.
- **Database**: SQLite (dev) / PostgreSQL (prod).
- **PDF Generation**: ReportLab for server-side, multi-section personalized PDF reports.
- **Admin**: Django Admin with CRUD operations, filters, search, and Excel export.
- **Payment**: Instamojo API for add-on purchases.

### Core Architectural Decisions
- **3-Layer PDF System (v3)**:
    1.  **Input Schema (Layer 1)**: Zod-validated input schema (`shared/input-schema.ts`) for strict data validation, including gender enumeration and required fields.
    2.  **Central Computation (Layer 2)**: Single source of truth for all health metrics (BMI, BMR, TDEE, macros) in `shared/computed-profile.ts` to prevent redundant calculations.
    3.  **Validation Controller (Layer 3)**: `server/lib/validation-controller.ts` performs 7 checks (e.g., gender-condition, macro accuracy, narrative-score consistency) with auto-correction loops (max 3 iterations) to ensure data integrity and consistency in the generated PDF data bundle.
- **LLM Constraint**: The narrative generator is explicitly instructed to only rewrite summaries using pre-computed data from Layer 2, strictly forbidding it from performing calculations.
- **Premium PDF Design (Navy+Gold)**: Full restructure of `client/lib/client-pdf-generator.ts` to a Navy+Gold design system. Color palette: NAVY (#0D1B2A), NAVY_MID (#1B2E44), GOLD (#C9A84C), CREAM (#F5F0E8). All existing sections automatically use Navy theme via backward-compat aliases. Premium helper functions: `drawSectionBanner`, `drawPremiumTable`, `drawMetricCards`, `drawGoldCallout`, `drawRootCauseChain`, `drawConditionTags`.
- **4 New Core PDF Sections**: (01) Personal Health Score Dashboard — 6-dimension wellness scoring with priority stack; (02) Metabolic Calculations — step-by-step BMI/BMR/TDEE formulas + metric cards + macro table; (03) Decision Engine & Root Cause Analysis — dynamic root cause chain + decision trees + priority stack; (04) 90-Day Weight Projection — checkpoint table with weekly targets.
- **Modular PDF Rendering**: The PDF generation process is broken down into 23+ section renderers using a `PDFContext` pattern, allowing dynamic composition and content variation based on user data and purchased tiers.
- **Data-Driven Content**: Rule engines (`server/lib/rule-engine.ts`) map user scores and conditions to activate specific modules, risk flags, lab priorities, and narrative hints.
- **Meal Generator**: `server/lib/meal-generator.ts` uses a 90-food Indian database, offering macro-driven, calorie-scaled portions with auto-scaling to maintain compliance.
- **Admin-Controlled Settings**: A `site_settings` PostgreSQL table allows administrators to modify live website content (banners, pricing page text, site info) without code deployments.

## External Dependencies
- **PostgreSQL**: Primary database for both React/Express and Django applications.
- **OpenAI**: Integrated via Replit AI Integrations for generating personalized narratives (gpt-5-mini).
- **Instamojo**: Payment gateway for processing user purchases and add-ons.
- **jsPDF**: Client-side library for PDF rendering in the React application.
- **ReportLab**: Server-side library for PDF generation in the Django application.
- **Vite**: Build tool for the React/Express application.
- **Tailwind CSS**: Utility-first CSS framework.
- **Radix UI**: Unstyled component library for building accessible UI.
- **Zod**: TypeScript-first schema declaration and validation library.
- **pandas**: Used in Django for Excel exports.
- **ExcelJS**: Used in Node.js for generating `.xlsx` files.
- **Gmail SMTP**: Optional, for sending emails (e.g., download links) from the admin system.

## Rule Engine Pipeline (Quiz → Rules → Template → PDF)
- **`shared/rules.json`**: Declarative rule config for calorie logic (surplus/deficit by goal), sleep severity, meal frequency, hydration targets, thyroid protocol, dietary restrictions (lactose/gluten), and shift work rules.
- **`shared/addon_rules.json`**: Gender-based addon filtering config — defines which addons are female-only (addon_women_hormone) vs. male-only (addon_men_fitness) vs. universal.
- **`client/lib/addon-filter.ts`**: Frontend gender filtering utility. `filterAddonsByGender()` hides incompatible addons on Pricing page. `validateAddonGenderMatch()` validates selections. `getStoredGender()` reads from localStorage.
- **`shared/template-mapper.ts`**: Resolves `{{goal_logic}}`, `{{meal_logic}}`, `{{sleep_logic}}`, `{{diet_logic}}`, `{{hydration_logic}}`, `{{supplement_logic}}`, `{{addon_logic}}` and profile placeholders in narrative text with fully computed, bilingual values.
- **Extended `server/lib/rule-engine.ts`**: New rule functions — `applyGoalCalorieLogic()` (flags gain/loss intent), `applyLowMealFrequencyRule()` (adds snack_protocol module for ≤2 meals/day), `applyHydrationRule()` (adds hydration_correction module for <1.5L), `applyShiftWorkRule()` (adds shift_sleep_protocol for shift/night/rotating schedules), `applyThyroidLabPriority()` (boosts thyroid lab to top priority with anti-TPO panel), `applyDietaryRestrictionNarratives()` (adds lactose/gluten protocol hints).
- **Extended `shared/pdf-validation.ts`**: `runPreGenerationChecks()` validates required profile fields, detects calorie contradictions (gain_weight with deficit), critical sleep (≤5hrs), thyroid flags, meal frequency feasibility, and gender-condition mismatches — blocks generation on critical errors, logs warnings for others. `validateAddonGenderCompatibility()` for server-side addon validation.
- **`client/pages/Pricing.tsx`**: Applies gender-based addon filtering on load using `getStoredGender()` and `filterAddonsByGender()` — male users never see Women's Hormonal Health, female users never see Men's Performance Pack.
- **`server/routes/payments.ts`**: Backend gender-addon validation via `validateGenderAddonCompat()` — rejects orders with incompatible addon/gender combinations with 400 error + descriptive message.
- **`client/lib/client-pdf-generator.ts`**: Integrated `runPreGenerationChecks()` as a pre-flight gate — throws on critical errors, logs warnings and auto-corrections before PDF generation begins.

## Recent Bug Fixes (14-Bug Audit)
- **activityMultiplier boundary** (`shared/computed-profile.ts`): Changed `< 40` to `<= 40` so score 40 maps to lightly-active.
- **Quiz map fixes** (`client/lib/quiz-analysis.ts`): Added "4-plus" meal frequency, "more-than-8" hydration, "no-goal" weight goal mapping. Removed orphaned stress/sleep/activity keys. Folded bloatingFrequency into digestiveIssues client-side.
- **PDF defaults** (`client/lib/client-pdf-generator.ts`): mealFreq default `|| 3`, waterLiters default `0.8` (was incorrect 1.5/1.2).
- **Input schema** (`shared/input-schema.ts`): mealFrequency min changed from 2 to 1 (supports OMAD).
- **B2B PostgreSQL persistence** (`server/routes/b2b.ts`): Fully rewritten from in-memory Maps to PostgreSQL tables (b2b_clients, b2b_tokens, b2b_links). Data survives server restarts. `initB2BTables()` called at startup from `server/index.ts`.
- **B2B double-submit guard**: Atomic `UPDATE ... WHERE is_used = FALSE RETURNING client_id` prevents race condition and inflated report counts.
- **Subscription card removal**: Filtered out from both Index.tsx and Pricing.tsx using PLAN_IDS.SUBSCRIPTION exclusion.
- **B2B URL fix**: Server now returns relative paths (`/quiz?b2b=TOKEN`), frontend prepends `window.location.origin` — eliminates double-domain bug.
- **B2B email sending** (`server/routes/b2b.ts`): `b2bSendQuizEmail` endpoint sends quiz link to user email via genewell11@gmail.com SMTP. Auto-sends when email is provided during link creation.
- **B2B quiz tracking** (`b2b_quiz_submissions` table): Records all B2B quiz attempts with user name, email, phone, age, gender, location, IP address, user agent. Displayed in "Users" tab of B2B dashboard.
- **B2B 30-day reminder** (`runSubscriptionReminders`): Daily cron checks for trial clients 30+ days old and sends upgrade reminder emails. Tracked in `b2b_reminder_log` table to prevent duplicates.
- **B2B registration**: Field label updated to "Business / Organization / Professional Name" with professionals in placeholder.
- **SMTP**: genewell11@gmail.com configured via `GMAIL_USER` + `GMAIL_APP_PASSWORD` env vars for all email sending (B2B quiz links, payment confirmations, report downloads, subscription reminders).