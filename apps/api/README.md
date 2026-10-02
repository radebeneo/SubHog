# Subscription Tracker API

A professional, production-ready backend API for managing subscriptions, featuring automated email reminders, advanced security, and robust database management.

## 🚀 Overview

The **Subscription Tracker API** is a comprehensive solution for users to manage their recurring subscriptions efficiently. It provides automated renewal notifications, integrated security features, and a scalable architecture built on Node.js and MongoDB.

## ✨ Key Features

-   **User Authentication**: Secure signup and login using JWT and Bcrypt for password hashing.
-   **Subscription Management**: Complete CRUD operations for tracking various subscription types (entertainment, health, sports, etc.).
-   **Automated Workflows**: Integration with **Upstash Workflow** to automatically trigger email reminders before subscription renewals (7, 5, 2, and 1 day before).
-   **Advanced Security**: 
    -   **Arcjet** integration for bot detection and rate limiting.
    -   Global error handling and input validation.
-   **Email Notifications**: Automated reminder emails sent via **Nodemailer**.
-   **Database**: Robust data modeling with **Mongoose** and **MongoDB**.

## 🛠️ Tech Stack

-   **Backend**: Node.js, Express.js
-   **Database**: MongoDB (Mongoose)
-   **Security**: Arcjet, JWT, Bcrypt
-   **Automation**: Upstash Workflow
-   **Utilities**: Dayjs (Date manipulation), Nodemailer (Emails), Morgan (Logging)

## 📁 Project Structure

```bash
├── src/
│   ├── config/         # Environment and third-party service configurations
│   ├── controllers/    # Request handlers
│   ├── database/       # Database connection setup
│   ├── middlewares/    # Authentication, security, and error handlers
│   ├── models/         # Mongoose data models
│   ├── routes/         # API endpoint definitions
│   ├── services/       # API services
│   ├── utils/          # Helper functions (e.g., email sending)
│   ├── app.js          # Express application configuration
│   └── server.js       # HTTP listener and database startup
└── tests/              # Isolated and integration tests
```

## ⚙️ Getting Started

### Prerequisites

-   Node.js installed
-   MongoDB account (Atlas or local)
-   Arcjet account (for security features)
-   Upstash account (for workflows)

### Installation

1.  Clone the repository and install from the monorepo root:
    ```bash
    git clone <repository-url>
    cd SubHog
    npm ci
    ```

3.  Set up environment variables:
    Create `.env.development.local` and `.env.production.local` files and populate them with the following:
    ```env
    PORT=5500
    SERVER_URL=http://localhost:5500
    NODE_ENV=development
    DB_URI=your_mongodb_uri
    JWT_SECRET=your_secret
    JWT_EXPIRES_IN=1d
    ARCJET_KEY=your_arcjet_key
    ARCJET_ENV=development
     QSTASH_URL=your_upstash_qstash_url
     QSTASH_TOKEN=your_upstash_qstash_token
     EMAIL_PASSWORD=your_email_app_password

     # Clerk JWT verification (all required)
     CLERK_JWKS_URL=https://your-clerk-domain/.well-known/jwks.json
     CLERK_ISSUER=https://your-clerk-domain
     CLERK_AUDIENCE=subscription-tracker
     CLERK_ALLOWED_ALGORITHMS=RS256
     CLERK_AUTHORIZED_PARTY_POLICY=required
     CLERK_AUTHORIZED_PARTIES=https://your-app.example
     CLERK_CLOCK_SKEW_SECONDS=5
     CLERK_JWKS_TIMEOUT_MS=5000
     CLERK_JWKS_REFRESH_COOLDOWN_MS=30000
     CLERK_JWKS_CACHE_MAX_AGE_MS=600000

     # Clerk profile retrieval (required when provisioning can be used)
     CLERK_API_BASE_URL=https://api.clerk.com
     CLERK_SECRET_KEY=sk_live_replace_me
     CLERK_PROFILE_TIMEOUT_MS=5000

     # Identity provisioning gate
     IDENTITY_PROVISIONING_ENABLED=false
     DB_RESOURCE_ID=production-database
     IDENTITY_PROVISIONING_RESOURCE_ID=production-database
     IDENTITY_PROVISIONING_RESOURCE_CONFIRMATION=ENABLE_PROVISIONING:production-database
     ```

### Clerk Verification Policy

The production process validates the complete Clerk verifier configuration before opening the HTTP listener. Remote JWKS retrieval remains lazy: keys are fetched only when a Clerk JWT first needs verification, then cached and refreshed within the configured timeout, cooldown, and cache limits.

`CLERK_AUDIENCE` is a comma-separated allowlist matched against the JWT `aud` claim. Set it to the audience configured in the Clerk JWT template used by clients. `CLERK_AUTHORIZED_PARTY_POLICY` must be explicit:

- `required` requires an `azp` claim present in the comma-separated `CLERK_AUTHORIZED_PARTIES` allowlist.
- `absent` requires the JWT to omit `azp`; leave `CLERK_AUTHORIZED_PARTIES` unset.

The API accepts identity only from verified Clerk JWT claims. It does not use native iOS/Android headers or client-provided user identifiers as identity evidence. Before release, obtain fresh session tokens from live iOS and Android builds and run `npm run test:integration:clerk-api --workspace=@subhog/api` with `INTEGRATION_CLERK_TOKEN_PRIMARY` and `INTEGRATION_CLERK_TOKEN_SECONDARY`. Confirm each platform token has the configured `iss` and `aud`, plus an `azp` that either matches the required allowlist or is absent under the `absent` policy. This live check matters because development tokens and platform session templates can carry different claims.

Provisioning is disabled unless `IDENTITY_PROVISIONING_ENABLED=true`. When enabled, `DB_RESOURCE_ID` and `IDENTITY_PROVISIONING_RESOURCE_ID` must match, and `IDENTITY_PROVISIONING_RESOURCE_CONFIRMATION` must equal `ENABLE_PROVISIONING:<resource-id>`. `CLERK_API_BASE_URL` must be a credential-free HTTPS origin; `CLERK_SECRET_KEY` is used only for server-side profile retrieval.

### Running the Application

-   Development mode:
    ```bash
    npm run dev --workspace=@subhog/api
    ```
-   Production mode:
    ```bash
    npm start --workspace=@subhog/api
    ```

## 🔌 API Endpoints

### Auth
- `POST /api/v1/auth/sign-up`: Register a new user
- `POST /api/v1/auth/sign-in`: Login user

### Users
- `GET /api/v1/users`: Intentionally unavailable. User enumeration is disabled to prevent cross-account data exposure; this route responds with `404`.
- `GET /api/v1/users/:id`: Get the authenticated user's own profile details only.

### Subscriptions
- `POST /api/v1/subscriptions`: Create a new subscription
- `GET /api/v1/subscriptions/user/:id`: Get all subscriptions for a specific user
- `PUT /api/v1/subscriptions/:id/cancel`: Cancel a subscription

## 🛡️ Security

The API uses **Arcjet** for:
-   **Bot Detection**: Preventing automated malicious requests.
-   **Rate Limiting**: Protecting the API from abuse.

## 📧 Automated Reminders

The system uses **Upstash Workflows** to monitor renewal dates. It automatically schedules reminders and sends emails using **Nodemailer** to ensure users never miss a renewal payment.
