import type { ConfigIssue, ValidatedEnv } from '../../config/env.validation';

/**
 * Human-readable configuration reporting.
 *
 * The API can boot in a deliberately degraded staging mode
 * (`ALLOW_DEGRADED_STARTUP=true`). When that happens an operator must be able
 * to answer two questions without reading the source: *what is missing* and
 * *what does it break*. The same summary is printed once at startup and served
 * by `GET /health`, so a mobile developer pointed at the staging URL sees the
 * same answer as the person who deployed it.
 *
 * Only variable NAMES and their consequences are reported. Values are never
 * read, logged, or serialised here.
 */

export const CONFIGURATION_DOC = 'docs/DEPLOYMENT_ENV_STAGING.md';

export interface ConfigurationSummary {
  /** True when required configuration is missing and the API started anyway. */
  degraded: boolean;
  environment: string;
  /** Missing/invalid settings, required ones first. */
  missing: ConfigIssue[];
  /** Count of settings that a normal production start would refuse to run without. */
  requiredMissing: number;
  docs: string;
  note: string;
}

export function configurationSummary(config: ValidatedEnv): ConfigurationSummary {
  const missing = [...config.configIssues].sort(
    (a, b) => Number(b.required) - Number(a.required) || a.variable.localeCompare(b.variable),
  );
  const requiredMissing = missing.filter((issue) => issue.required).length;
  return {
    degraded: config.degraded,
    environment: config.nodeEnv,
    missing,
    requiredMissing,
    docs: CONFIGURATION_DOC,
    note: config.degraded
      ? 'This API is running in degraded staging mode. Missing required settings are listed above; gated features fail closed with 503 instead of pretending to work.'
      : requiredMissing === 0
        ? 'All required configuration is present. Optional providers listed above are disabled and fail closed.'
        : 'Required configuration is missing.',
  };
}

/**
 * Prints the configuration state once per process start. Intentionally loud:
 * a degraded deployment should be impossible to miss in the logs.
 */
export function logConfigurationReport(
  config: ValidatedEnv,
  logger: { warn: (message: string) => void; log?: (message: string) => void } = console,
): void {
  if (config.nodeEnv === 'test') return;
  const summary = configurationSummary(config);
  if (summary.missing.length === 0) {
    (logger.log ?? logger.warn)('✅ Obiren configuration complete: every required and optional setting is present.');
    return;
  }

  const lines: string[] = [];
  if (summary.degraded) {
    lines.push(
      `⚠️  DEGRADED STARTUP: ${summary.requiredMissing} required setting(s) missing. The API serves requests, but the affected features fail closed.`,
    );
  } else {
    lines.push('⚠️  Obiren configuration warnings (optional providers disabled):');
  }

  for (const issue of summary.missing) {
    const tag = issue.required ? 'REQUIRED' : 'optional';
    lines.push(`   - [${tag}] ${issue.variable} — ${issue.feature}: ${issue.impact}`);
  }
  lines.push(`   Full deployment guide: ${CONFIGURATION_DOC}`);
  logger.warn(`\n${lines.join('\n')}\n`);
}

/**
 * `details` payload for a 503 caused by a missing setting, so the client sees
 * which variable to ask the operator for instead of a bare error message.
 */
export function missingConfigurationDetails(requiredEnv: string[], feature: string) {
  return { feature, requiredEnv, docs: CONFIGURATION_DOC };
}
