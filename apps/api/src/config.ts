try {
  process.loadEnvFile();
} catch {
  // No .env file: rely on the real environment.
}

const modelsBaseUrl = (process.env.MODELS_BASE_URL || "/models").replace(/\/$/, "");

export const config = {
  port: Number(process.env.PORT ?? 3100),
  host: process.env.HOST ?? "0.0.0.0",
  isProd: process.env.NODE_ENV === "production",
  corsOrigin: (process.env.CORS_ORIGIN ?? "http://localhost:5173").split(","),
  databaseUrl: process.env.DATABASE_URL || undefined,
  pgliteDir: process.env.PGLITE_DIR ?? ".pglite",
  supabaseUrl: process.env.SUPABASE_URL || undefined,
  supabaseJwtSecret: process.env.SUPABASE_JWT_SECRET || undefined,
  modelsBaseUrl,
  /** Models are served by the API itself unless they live on another host. */
  serveModels: !/^https?:\/\//.test(modelsBaseUrl),
};

export type Config = typeof config;
