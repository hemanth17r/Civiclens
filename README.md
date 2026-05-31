# CivicLens

CivicLens is a decentralized, crowdsourced municipal reporting and validation platform. It empowers citizens to report local infrastructure issues and leverages a community-driven consensus model to verify them, ensuring city officials receive high-signal, actionable data.

## Key Features

- **Crowdsourced Issue Reporting**: Hyper-local feed using proximity algorithms to cluster users by their city and neighboring cities.
- **Trust-Weighted Consensus**: A self-governing system that validates issues through citizen voting based on dynamic "Trust Scores."
- **Interactive Gamification**: Users earn Experience Points (XP), maintain streaks, and unlock badges for active, constructive participation.
- **Municipal CRM & Smart Triage**: A dedicated authenticated portal where issues are automatically routed to the right departments (e.g., Sanitation, Water Supply) for officials to review and resolve.
- **Anti-Manipulation & SLA Alerts**: Enforces rate limits to prevent spam and triggers escalation alerts if highly-supported issues remain unresolved for over 72 hours.

## Technology Stack

- **Frontend**: Next.js 16 (App Router), React 19, TailwindCSS v4, Framer Motion
- **Backend**: Next.js Serverless API Routes
- **Database**: Firebase Cloud Firestore (NoSQL)
- **Authentication**: Firebase Authentication (Passwordless Magic Links & Google OAuth)
- **Storage**: Supabase Storage for fast, direct client-side media uploads

## Getting Started

### Prerequisites
Ensure you have Node.js and npm installed.

### Installation
1. Clone the repository and navigate to the project directory:
   ```bash
   cd civiclens
   ```
2. Install the project dependencies:
   ```bash
   npm install
   ```
3. Create a `.env.local` file. You will need to add your Firebase and Supabase credentials as specified in the technical documentation.

### Running the Application

- **Start the Development Server** (accessible at `http://localhost:3000`):
  ```bash
  npm run dev
  ```
- **Build for Production**:
  ```bash
  npm run build
  ```
- **Start the Production Server**:
  ```bash
  npm run start
  ```


## Live Production
The application is deployed via Vercel and accessible live at **[civiclens.tech](https://civiclens.tech)**.
