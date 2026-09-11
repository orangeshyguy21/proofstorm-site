import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';

const localEnv = fileURLToPath(new URL('../.env', import.meta.url));
if (existsSync(localEnv)) loadEnvFile(localEnv);
