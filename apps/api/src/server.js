import { PORT } from './config/env.js';
import connectToDatabase from './database/mongodb.js';
import app from './app.js';
import { initializeClerkVerifier } from './middlewares/clerk-auth.middleware.js';

console.log('[api] NODE_ENV:', process.env.NODE_ENV);
initializeClerkVerifier();
const server = app.listen(PORT, async () => {
    console.log(`Subscription Tracker API is running on http://localhost:${PORT}`);

    await connectToDatabase();
});

export default server;
