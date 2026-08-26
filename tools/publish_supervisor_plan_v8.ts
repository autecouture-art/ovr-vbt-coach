import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { homedir } from "node:os";

import {
  computeSupervisorProgramChecksum,
  normalizeSupervisorProgramPlan,
  validateSupervisorProgramPlan,
  type SupervisorProgramPlanV8,
} from "../src/utils/SupervisorProgramPlan";

export const DEFAULT_SUPERVISOR_PLAN_INPUT =
  "docs/repvelocoach_program_menu_current_20260623_fullbody_main_plus_tempo.json";
export const DEFAULT_SUPERVISOR_PLAN_OUTPUT =
  "~/Library/Application Support/WELDPEAK/repvelocoach-supervisor-plan-current.json";

type PublishOverrides = Partial<
  Pick<SupervisorProgramPlanV8, "version" | "updated_at" | "effective_from" | "valid_until" | "source">
>;

export function expandHomePath(path: string): string {
  return path.startsWith("~/") ? resolve(homedir(), path.slice(2)) : resolve(path);
}

export async function packageSupervisorPlanFromFile(
  inputPath: string,
  overrides: PublishOverrides = {},
): Promise<SupervisorProgramPlanV8> {
  const raw = JSON.parse(await readFile(inputPath, "utf8"));
  const normalized = normalizeSupervisorProgramPlan(raw);
  if (!normalized) throw new Error("監督メニューJSONのschemaを認識できません。");
  const withoutChecksum = {
    ...normalized,
    ...overrides,
    checksum: "",
  };
  const signed = {
    ...withoutChecksum,
    checksum: computeSupervisorProgramChecksum(withoutChecksum),
  };
  const validation = validateSupervisorProgramPlan(signed);
  if (!validation.ok || !validation.plan) {
    throw new Error(`監督メニューvalidation失敗:\n${validation.errors.join("\n")}`);
  }
  return validation.plan;
}

export async function publishSupervisorPlanAtomically(
  plan: SupervisorProgramPlanV8,
  outputPath: string,
): Promise<string> {
  const resolved = expandHomePath(outputPath);
  const validation = validateSupervisorProgramPlan(plan);
  if (!validation.ok || !validation.plan) {
    throw new Error(`publish前validation失敗:\n${validation.errors.join("\n")}`);
  }
  await mkdir(dirname(resolved), { recursive: true });
  const tempPath = `${resolved}.tmp-${process.pid}`;
  await writeFile(tempPath, `${JSON.stringify(validation.plan, null, 2)}\n`, "utf8");
  await rename(tempPath, resolved);
  return resolved;
}

function parseArgs(argv: string[]) {
  const args = {
    input: DEFAULT_SUPERVISOR_PLAN_INPUT,
    output: DEFAULT_SUPERVISOR_PLAN_OUTPUT,
    dryRun: false,
    overrides: {} as PublishOverrides,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") {
      continue;
    } else if (arg === "--input" && argv[index + 1]) {
      args.input = argv[index + 1];
      index += 1;
    } else if (arg === "--output" && argv[index + 1]) {
      args.output = argv[index + 1];
      index += 1;
    } else if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--version" && argv[index + 1]) {
      args.overrides.version = argv[index + 1];
      index += 1;
    } else if (arg === "--updated-at" && argv[index + 1]) {
      args.overrides.updated_at = argv[index + 1];
      index += 1;
    } else if (arg === "--effective-from" && argv[index + 1]) {
      args.overrides.effective_from = argv[index + 1];
      index += 1;
    } else if (arg === "--valid-until" && argv[index + 1]) {
      args.overrides.valid_until = argv[index + 1];
      index += 1;
    } else if (arg === "--source" && argv[index + 1]) {
      args.overrides.source = argv[index + 1];
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const input = resolve(args.input);
  const plan = await packageSupervisorPlanFromFile(input, args.overrides);
  if (!args.dryRun) {
    const output = await publishSupervisorPlanAtomically(plan, args.output);
    console.log(`published: ${output}`);
  }
  console.log(
    JSON.stringify(
      {
        plan_id: plan.plan_id,
        version: plan.version,
        checksum: plan.checksum,
        rows: plan.rows.length,
        valid_until: plan.valid_until ?? null,
      },
      null,
      2,
    ),
  );
}

if (process.argv[1] && process.argv[1].endsWith("publish_supervisor_plan_v8.ts")) {
  void main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
