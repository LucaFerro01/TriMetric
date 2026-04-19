import { execFile } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "..", "..");
const MCP_MODE = (process.env.MCP_MODE || "readonly").toLowerCase() === "write" ? "write" : "readonly";
const LOG_PATH = join(REPO_ROOT, ".mcp", "invocations.log");

const TOOL_TIMEOUTS_MS = {
  quality_check: 10 * 60 * 1000,
  build_check: 15 * 60 * 1000,
  dev_boot: 3 * 60 * 1000,
  backend_migrate: 5 * 60 * 1000,
  changed_files_review: 60 * 1000,
  env_sanity_check: 30 * 1000,
};

const WRITE_TOOLS = new Set(["dev_boot", "backend_migrate"]);
const APPROVED_COMMANDS = new Set(["pnpm", "docker", "git"]);
const MAX_OUTPUT_CHARS = 12000;

mkdirSync(dirname(LOG_PATH), { recursive: true });

function logInvocation(entry) {
  const line = JSON.stringify({ timestamp: new Date().toISOString(), ...entry });
  appendFileSync(LOG_PATH, `${line}\n`, "utf8");
}

function sanitizeOutput(value) {
  if (!value) {
    return "";
  }
  const normalized = String(value).trim();
  if (normalized.length <= MAX_OUTPUT_CHARS) {
    return normalized;
  }
  return `${normalized.slice(0, MAX_OUTPUT_CHARS)}\n... output truncated ...`;
}

function isWithinRepo(candidatePath) {
  const resolvedCandidate = resolve(candidatePath);
  return resolvedCandidate === REPO_ROOT || resolvedCandidate.startsWith(`${REPO_ROOT}/`);
}

async function runApprovedCommand({ toolName, command, args, timeoutMs }) {
  if (!APPROVED_COMMANDS.has(command)) {
    throw new Error(`Command not approved by allowlist: ${command}`);
  }

  if (!isWithinRepo(REPO_ROOT)) {
    throw new Error("Scope violation: repository root is not valid.");
  }

  const startedAt = Date.now();
  try {
    const result = await execFileAsync(command, args, {
      cwd: REPO_ROOT,
      timeout: timeoutMs,
      maxBuffer: 8 * 1024 * 1024,
      env: process.env,
    });

    const durationMs = Date.now() - startedAt;
    const stdout = sanitizeOutput(result.stdout);
    const stderr = sanitizeOutput(result.stderr);

    logInvocation({
      toolName,
      command,
      args,
      exitCode: 0,
      durationMs,
      success: true,
    });

    return { stdout, stderr, exitCode: 0, durationMs };
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const stdout = sanitizeOutput(error.stdout);
    const stderr = sanitizeOutput(error.stderr || error.message);
    const exitCode = typeof error.code === "number" ? error.code : 1;

    logInvocation({
      toolName,
      command,
      args,
      exitCode,
      durationMs,
      success: false,
      error: sanitizeOutput(error.message),
    });

    return { stdout, stderr, exitCode, durationMs };
  }
}

function ensureWriteAllowed(toolName) {
  if (WRITE_TOOLS.has(toolName) && MCP_MODE !== "write") {
    throw new Error(`Tool '${toolName}' is disabled in readonly mode. Set MCP_MODE=write to enable write actions.`);
  }
}

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return { exists: false, values: {} };
  }

  const text = readFileSync(filePath, "utf8");
  const values = {};

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const equalsIdx = line.indexOf("=");
    if (equalsIdx <= 0) {
      continue;
    }
    const key = line.slice(0, equalsIdx).trim();
    const value = line.slice(equalsIdx + 1).trim();
    values[key] = value;
  }

  return { exists: true, values };
}

function isPlaceholder(value) {
  if (!value) {
    return true;
  }
  const lowered = value.toLowerCase();
  return (
    lowered.includes("your_") ||
    lowered.includes("change-this") ||
    lowered.includes("example.com") ||
    lowered.includes("placeholder") ||
    lowered.includes("replace_me")
  );
}

function checkUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

async function toolQualityCheck() {
  return runApprovedCommand({
    toolName: "quality_check",
    command: "pnpm",
    args: ["lint"],
    timeoutMs: TOOL_TIMEOUTS_MS.quality_check,
  });
}

async function toolBuildCheck() {
  return runApprovedCommand({
    toolName: "build_check",
    command: "pnpm",
    args: ["build"],
    timeoutMs: TOOL_TIMEOUTS_MS.build_check,
  });
}

async function toolDevBoot(rawArgs) {
  const args = rawArgs || {};
  const requested = Array.isArray(args.services) ? args.services : [];
  const allowedServices = new Set(["postgres", "redis", "api", "worker", "frontend"]);
  const defaultServices = ["postgres", "redis", "api", "worker", "frontend"];

  const selectedServices = (requested.length ? requested : defaultServices).filter((name) => allowedServices.has(name));
  if (selectedServices.length === 0) {
    throw new Error("No valid services selected. Allowed: postgres, redis, api, worker, frontend.");
  }

  return runApprovedCommand({
    toolName: "dev_boot",
    command: "docker",
    args: ["compose", "up", "-d", ...selectedServices],
    timeoutMs: TOOL_TIMEOUTS_MS.dev_boot,
  });
}

async function toolBackendMigrate(rawArgs) {
  const args = rawArgs || {};
  if (args.confirm !== true) {
    return {
      stdout: "",
      stderr: "Manual confirmation required. Re-run backend_migrate with { \"confirm\": true }.",
      exitCode: 2,
      durationMs: 0,
    };
  }

  return runApprovedCommand({
    toolName: "backend_migrate",
    command: "pnpm",
    args: ["--filter", "@trimetric/backend", "migrate"],
    timeoutMs: TOOL_TIMEOUTS_MS.backend_migrate,
  });
}

async function toolChangedFilesReview() {
  const [status, unstagedNames, stagedNames, diffStat, diffPatch] = await Promise.all([
    runApprovedCommand({ toolName: "changed_files_review", command: "git", args: ["status", "--short"], timeoutMs: TOOL_TIMEOUTS_MS.changed_files_review }),
    runApprovedCommand({ toolName: "changed_files_review", command: "git", args: ["diff", "--name-only"], timeoutMs: TOOL_TIMEOUTS_MS.changed_files_review }),
    runApprovedCommand({ toolName: "changed_files_review", command: "git", args: ["diff", "--name-only", "--cached"], timeoutMs: TOOL_TIMEOUTS_MS.changed_files_review }),
    runApprovedCommand({ toolName: "changed_files_review", command: "git", args: ["diff", "--stat"], timeoutMs: TOOL_TIMEOUTS_MS.changed_files_review }),
    runApprovedCommand({ toolName: "changed_files_review", command: "git", args: ["diff", "--unified=0"], timeoutMs: TOOL_TIMEOUTS_MS.changed_files_review }),
  ]);

  const files = new Set();
  for (const chunk of [unstagedNames.stdout, stagedNames.stdout]) {
    for (const line of chunk.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)) {
      files.add(line);
    }
  }

  const changedFiles = [...files].sort();
  const highRiskPatterns = [
    /^backend\/src\/db\//,
    /^backend\/drizzle\//,
    /^backend\/src\/routes\//,
    /^frontend\/src\/api\//,
    /^docker-compose\.yml$/,
  ];

  const highRisk = changedFiles.filter((file) => highRiskPatterns.some((pattern) => pattern.test(file)));
  const touchedTests = changedFiles.some((file) => /(__tests__|\.test\.|\.spec\.)/.test(file));

  const findings = [];
  if (highRisk.length) {
    findings.push(`High-risk files changed: ${highRisk.join(", ")}`);
  }
  if (!touchedTests && changedFiles.length > 0) {
    findings.push("No test files changed; consider adding or updating tests for modified behavior.");
  }
  if (changedFiles.some((f) => f.startsWith("backend/drizzle/"))) {
    findings.push("Database migration files changed; validate migration order and rollback strategy.");
  }

  const summary = [
    `Changed files count: ${changedFiles.length}`,
    changedFiles.length ? `Changed files: ${changedFiles.join(", ")}` : "Changed files: none",
    findings.length ? `Review findings: ${findings.join(" | ")}` : "Review findings: no obvious high-risk indicators detected.",
    `Git status:\n${status.stdout || "clean"}`,
    `Diff stat:\n${diffStat.stdout || "(empty)"}`,
    `Patch preview (truncated):\n${sanitizeOutput(diffPatch.stdout) || "(empty)"}`,
  ].join("\n\n");

  return {
    stdout: summary,
    stderr: [status.stderr, unstagedNames.stderr, stagedNames.stderr, diffStat.stderr, diffPatch.stderr].filter(Boolean).join("\n"),
    exitCode: [status, unstagedNames, stagedNames, diffStat, diffPatch].some((r) => r.exitCode !== 0) ? 1 : 0,
    durationMs: 0,
  };
}

async function toolEnvSanityCheck() {
  const backendEnv = parseEnvFile(join(REPO_ROOT, "backend", ".env"));
  const composeEnv = parseEnvFile(join(REPO_ROOT, ".env"));

  const requiredBackendKeys = [
    "DATABASE_URL",
    "REDIS_URL",
    "FRONTEND_URL",
    "BACKEND_URL",
    "SESSION_SECRET",
    "JWT_SECRET",
    "STRAVA_CLIENT_ID",
    "STRAVA_CLIENT_SECRET",
    "STRAVA_WEBHOOK_VERIFY_TOKEN",
  ];

  const errors = [];
  const warnings = [];

  if (!backendEnv.exists) {
    errors.push("Missing backend/.env file.");
  } else {
    for (const key of requiredBackendKeys) {
      const value = backendEnv.values[key];
      if (!value) {
        errors.push(`backend/.env missing required key: ${key}`);
        continue;
      }
      if (isPlaceholder(value)) {
        warnings.push(`backend/.env key ${key} still looks like a placeholder value.`);
      }
    }

    if (backendEnv.values.FRONTEND_URL && !checkUrl(backendEnv.values.FRONTEND_URL)) {
      errors.push("FRONTEND_URL is not a valid URL.");
    }
    if (backendEnv.values.BACKEND_URL && !checkUrl(backendEnv.values.BACKEND_URL)) {
      errors.push("BACKEND_URL is not a valid URL.");
    }
    if ((backendEnv.values.BACKEND_URL || "").includes("localhost")) {
      warnings.push("BACKEND_URL points to localhost; Strava webhook callbacks require a publicly reachable URL.");
    }
  }

  if (!composeEnv.exists) {
    warnings.push("Root .env not found. Docker Compose variable interpolation will use defaults from docker-compose.yml.");
  }

  const summary = [
    `MCP mode: ${MCP_MODE}`,
    `Repo root: ${REPO_ROOT}`,
    errors.length ? `Errors (${errors.length}): ${errors.join(" | ")}` : "Errors (0): none",
    warnings.length ? `Warnings (${warnings.length}): ${warnings.join(" | ")}` : "Warnings (0): none",
  ].join("\n");

  return {
    stdout: summary,
    stderr: "",
    exitCode: errors.length ? 1 : 0,
    durationMs: 0,
  };
}

const tools = [
  {
    name: "quality_check",
    description: "Run repository lint checks (pnpm lint). Readonly-safe.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "build_check",
    description: "Run repository build checks (pnpm build). Readonly-safe.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "dev_boot",
    description: "Start local Docker services using docker compose up -d. Requires MCP_MODE=write.",
    inputSchema: {
      type: "object",
      properties: {
        services: {
          type: "array",
          items: {
            type: "string",
            enum: ["postgres", "redis", "api", "worker", "frontend"],
          },
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "backend_migrate",
    description: "Run backend DB migrations. Requires MCP_MODE=write and explicit confirm=true.",
    inputSchema: {
      type: "object",
      properties: {
        confirm: { type: "boolean" },
      },
      required: ["confirm"],
      additionalProperties: false,
    },
  },
  {
    name: "changed_files_review",
    description: "Review current git changes and return risk-oriented findings.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "env_sanity_check",
    description: "Validate essential environment variables for backend and docker usage.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
];

const server = new Server(
  {
    name: "trimetric-mcp",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name;
  const args = request.params.arguments || {};

  try {
    ensureWriteAllowed(toolName);

    let result;
    switch (toolName) {
      case "quality_check":
        result = await toolQualityCheck();
        break;
      case "build_check":
        result = await toolBuildCheck();
        break;
      case "dev_boot":
        result = await toolDevBoot(args);
        break;
      case "backend_migrate":
        result = await toolBackendMigrate(args);
        break;
      case "changed_files_review":
        result = await toolChangedFilesReview();
        break;
      case "env_sanity_check":
        result = await toolEnvSanityCheck();
        break;
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }

    const text = [
      `tool: ${toolName}`,
      `exitCode: ${result.exitCode}`,
      `stdout:\n${result.stdout || "(empty)"}`,
      result.stderr ? `stderr:\n${result.stderr}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    return {
      isError: result.exitCode !== 0,
      content: [{ type: "text", text }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logInvocation({
      toolName,
      command: "<internal>",
      args: [],
      exitCode: 1,
      durationMs: 0,
      success: false,
      error: sanitizeOutput(message),
    });

    return {
      isError: true,
      content: [{ type: "text", text: `tool: ${toolName}\n\nerror: ${message}` }],
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  logInvocation({
    toolName: "server_startup",
    command: "<startup>",
    args: [],
    exitCode: 1,
    durationMs: 0,
    success: false,
    error: sanitizeOutput(message),
  });
  process.stderr.write(`Failed to start MCP server: ${message}\n`);
  process.exit(1);
});
