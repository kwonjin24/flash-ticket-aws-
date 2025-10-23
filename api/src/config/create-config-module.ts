import { ConfigModule } from '@nestjs/config';
import { join } from 'node:path';

export function createConfigModule() {
  const shouldLoadEnvFiles =
    (process.env.LOAD_ENV_FILES ?? 'true').toLowerCase() !== 'false';
  const currentEnv = process.env.NODE_ENV ?? 'local';
  if (process.env.NODE_ENV !== 'test') {
    console.info(
      `[Config] LOAD_ENV_FILES=${shouldLoadEnvFiles} (NODE_ENV=${currentEnv})`,
    );
  }
  const envFilePath = !shouldLoadEnvFiles
    ? []
    : (() => {
        const env = process.env.NODE_ENV ?? 'local';
        const candidates = [
          `.env.${env}.local`,
          `.env.${env}`,
          '.env.local',
          '.env',
        ];
        const directories = new Set<string>([
          process.cwd(),
          __dirname,
          join(__dirname, '..'),
          join(__dirname, '..', '..'),
        ]);
        const resolved = new Set<string>();
        for (const dir of directories) {
          for (const base of candidates) {
            resolved.add(join(dir, base));
          }
        }
        return Array.from(resolved);
      })();
  return ConfigModule.forRoot({
    isGlobal: true,
    ignoreEnvFile: !shouldLoadEnvFiles,
    envFilePath,
  });
}
