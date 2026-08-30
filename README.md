# Loopdn Frontend

Loopdn is a community messaging and group management MVP built as a modern web app. This frontend focuses on the experience for users to sign in, create loops, manage group settings, and participate in chat-style or broadcast-style communication workflows.

## Overview

The app currently includes:

- Login and signup flows
- Email and phone-based authentication UX
- Session-based redirect logic for authenticated users
- A dashboard for viewing and creating loops
- Create-loop modal and configuration form
- Group messaging UI and mock WebSocket status handling
- Admin settings and member moderation mock panels
- User settings modal

This is an MVP frontend intended to connect with a backend service later, with demo-mode auth and mock data used where backend integration is still pending.

## Tech Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- ESLint
- App Router architecture

## Prerequisites

Make sure you have the following installed:

- Node.js 18+
- npm

## Running Locally

1. Install dependencies:

```bash
npm install
```

2. Start the development server:

```bash
npm run dev
```

3. Open the app in your browser:

```text
http://localhost:3000
```

## Production Build

To create a production build:

```bash
npm run build
```

To run the production server:

```bash
npm run start
```

## Project Structure

```text
src/
  app/
    api/
      auth/
        login/
        logout/
        signup/
    home/
    login/
    signup/
  components/
    auth/
    home/
    settings/
  lib/
    auth/
    theme/
    validation/
    websocket/
```

## Notes

- Authentication currently uses demo credentials for the MVP experience.
- Real backend integration for persistence, WebSocket messaging, and production auth is planned.
- The frontend is designed to be easy to connect to Django or another backend API layer in the next phase.

## Scripts

```bash
npm run dev      # run app in development mode
npm run build    # build for production
npm run start    # run the production build
npm run lint     # run ESLint checks
npm run format   # format files with Prettier
npm run format:check # verify Prettier formatting
npm run typecheck # run TypeScript checks
```

## Continuous Integration

GitHub Actions runs on pushes and pull requests to verify linting, Prettier formatting, TypeScript, and the production build. It uses `npm ci` with Node.js 20 for reproducible dependency installation.

## Continuous Deployment

After the CI workflow succeeds, GitHub Actions deploys the `staging` and `main` branches to separate AWS ECS/Fargate services using the shared production Docker image. The production job uses GitHub's `production` environment. Configure required reviewers for that environment in the repository settings to require manual approval before AWS deployment.

Configure the following GitHub Actions secret in both the `staging` and `production` environments:

- `AWS_ROLE_TO_ASSUME` for an AWS IAM role trusted by GitHub Actions OIDC

Configure the following GitHub Actions variables in both environments. Use environment-specific values for the ECR repository and ECS resources.

- `AWS_REGION`
- `ECR_REPOSITORY`
- `ECS_CLUSTER`
- `ECS_SERVICE`
- `ECS_TASK_DEFINITION` (task definition family name or ARN)
- `ECS_CONTAINER_NAME` (the container name in the task definition)

Each IAM role needs permission to authenticate and push to its selected ECR repository and to describe, register, and update its ECS service and task definition.
