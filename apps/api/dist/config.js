import 'dotenv/config';
import { resolve } from 'node:path';
import { z } from 'zod';
const raw = z.object({
    PORT: z.coerce.number().default(4000),
    CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
    JWT_SECRET: z.string().min(32).default('development-secret-change-before-prod'),
    DATABASE_PATH: z.string().default('./data/chat.db'),
    UPLOAD_DIR: z.string().default('./uploads'),
    MAX_FILE_SIZE_MB: z.coerce.number().positive().default(20),
}).parse(process.env);
export const config = {
    ...raw,
    DATABASE_PATH: resolve(process.cwd(), raw.DATABASE_PATH),
    UPLOAD_DIR: resolve(process.cwd(), raw.UPLOAD_DIR),
};
