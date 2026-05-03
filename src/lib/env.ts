const REQUIRED_VARS = ["DATABASE_URL", "ENCRYPTION_KEY", "APP_SECRET"] as const;

export function validateEnv(): void {
  const missing = REQUIRED_VARS.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    console.error(
      `[startup] Missing required environment variables: ${missing.join(", ")}\n` +
        "Copy .env.example to .env and fill in the missing values."
    );
    process.exit(1);
  }

  const key = process.env.ENCRYPTION_KEY!;
  if (key.length !== 64 || !/^[0-9a-fA-F]+$/.test(key)) {
    console.error(
      "[startup] ENCRYPTION_KEY must be exactly 64 hex characters.\n" +
        "Generate one with: openssl rand -hex 32"
    );
    process.exit(1);
  }
}
