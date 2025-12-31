# Chat App Monorepo

## Overview
This is a monorepo for a Real-time Chat Application utilizing **NestJS** for the backend and **Next.js** for the frontend, sharing common types via a local workspace package.

## Tech Stack
- **Backend**: NestJS 11, Prisma, MongoDB, Redis
- **Frontend**: Next.js 15 (App Router), TailwindCSS
- **Shared**: TypeScript Interfaces/Types
- **Tooling**: pnpm, Turborepo, Docker

## Structure
- `/backend`: NestJS API application
- `/frontend`: Next.js web application
- `/packages/shared`: Shared TypeScript types and utilities

## Getting Started

### Prerequisites
- Node.js (v20+)
- pnpm
- Docker & Docker Compose

### Installation
```bash
pnpm install
```

### Running Infrastructure
```bash
docker-compose up -d
```

### Development
```bash
pnpm dev
# or
turbo run dev
```

### Build
```bash
pnpm build
```
