import "server-only";

import { serverEnvSchema, type ServerEnv } from "@/lib/validation/env";

let cached: ServerEnv | undefined;

/** Validated server env, including secrets. Server code only. */
export function getServerEnv(): ServerEnv {
  cached ??= serverEnvSchema.parse(process.env);
  return cached;
}
