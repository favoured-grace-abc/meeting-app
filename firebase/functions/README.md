# Firebase Cloud Functions (Blaze Required)

These Cloud Functions require the Firebase Blaze (pay-as-you-go) plan.
The Spark (free) plan does not support Cloud Functions.

## Alternative for Spark plan

Instead of Cloud Functions, the app uses:
1. **Direct Firestore operations** for meeting CRUD
2. **Lightweight token server** (`/token-server/`) for LiveKit JWT tokens

To use the token server:
```bash
cd token-server
cp .env.example .env  # fill in LiveKit credentials
npm install
npm start
```

Upgrade to Blaze when ready for production, then:
```bash
npm install -g firebase-tools
cd firebase/functions
npm install
firebase deploy --only functions
```
