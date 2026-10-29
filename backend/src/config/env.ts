import dotenv from 'dotenv';
import { resolve } from 'path';
// Works from source and compiled dist; deployed environment variables take precedence.
dotenv.config({ path: resolve(__dirname, '../../.env') });
