# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an AI-powered SaaS platform for creating and studying personalized learning courses. The application includes:
- AI tutoring and course generation
- Multi-language support (English/Chinese) 
- Creator marketplace for course sharing
- User authentication and payment integration
- Image generation capabilities

## Development Commands

### Core Development
- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm lint` - Run Biome linter with auto-fix
- `pnpm format` - Format code with Biome

### Database Operations
- `pnpm db:generate` - Generate database migrations
- `pnpm db:migrate` - Run database migrations  
- `pnpm db:push` - Push schema changes to database
- `pnpm db:studio` - Open Drizzle Studio
- `pnpm db:clear` - Clear all database data
- `pnpm fix-db` - Fix database schema issues

### Creator Features
- `pnpm setup-creators` - Set up creator accounts
- `pnpm test-creator` - Test creator functionality

### Deployment
- `pnpm preview` - Preview Cloudflare build locally
- `pnpm deploy` - Deploy to Cloudflare
- `pnpm cf-typegen` - Generate Cloudflare types

## Architecture

### Framework Stack
- **Frontend**: Next.js 15 with App Router
- **Database**: PostgreSQL with Drizzle ORM
- **Auth**: Better Auth with Google OAuth
- **Payments**: Stripe integration
- **UI**: Radix UI + Tailwind CSS + shadcn/ui
- **AI**: Vercel AI SDK with multiple providers
- **Internationalization**: next-intl
- **Email**: React Email + Resend

### Key Directory Structure
- `src/app/` - Next.js App Router pages and API routes
- `src/components/` - Reusable UI components
- `src/db/` - Database schema and migrations
- `src/lib/` - Utility libraries and configurations
- `src/actions/` - Server actions
- `src/hooks/` - React hooks
- `src/stores/` - Zustand state management

### Database Schema
- **user**: User accounts with creator flag support
- **userCourses**: Learning course plans with AI-generated content
- **courseTasks**: Individual tasks within courses
- **courseChatHistory**: AI chat session storage
- **creatorCourses**: Public course marketplace with SEO-friendly slugs
- **payment**: Stripe subscription management

### Authentication System
- Uses Better Auth with Drizzle adapter
- Supports Google OAuth and email/password
- Session management with cookie caching
- Admin plugin for user management

### AI Features
- Course plan generation via `/api/learning/plan/stream_generate`
- Task generation and evaluation
- Chat interface for learning assistance
- Multi-provider image generation
- Text analysis and suggestion features

### Creator System
- Public course marketplace at `/course-marketplace`
- SEO-friendly URLs via slug system in `creatorCourses` table
- Creator utils in `src/lib/creator-utils.ts`

### Important Notes
- Uses Biome for linting/formatting (not Prettier/ESLint)
- Database migrations are in `src/db/migrations/`
- Configuration is centralized in `src/config/website.tsx`
- Internationalization messages in `src/i18n/messages.ts`
- Route definitions in `src/routes.ts`