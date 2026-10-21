import {config} from 'dotenv';

config({ path: `.env.${process.env.NODE_ENV || 'development'}.local`});
config({ path: '.env' });

export const {PORT, NODE_ENV,
    JWT_SECRET, JWT_EXPIRES_IN
} = process.env;

export const DB_URI = process.env.DB_URI || process.env.MONGODB_URI;
export const DB_NAME = process.env.DB_NAME;
