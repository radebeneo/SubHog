import express from 'express';
import cookieParser from "cookie-parser";

import userRouter from './routes/user.routes.js';
import subscriptionRouter from './routes/subscription.routes.js';
import authRouter from "./routes/auth.routes.js";
import identityRouter from "./routes/identity.routes.js";
import errorMiddleware from "./middlewares/error.middleware.js";


const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser())


app.use('/api/v1/auth', authRouter);
app.use('/api/v1/identity', identityRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/subscriptions', subscriptionRouter);

app.use(errorMiddleware)

app.get('/', (req, res) => {
    res.send('Welcome to the Subscription Tracker API!');
})

export default app;
