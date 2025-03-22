import inquirer from "inquirer";
import degit from "degit";
import { existsSync, rmSync } from "fs";
import { join } from "path";
import which from "which";
import { spawnSync } from "child_process";
import chalk from "chalk";
import boxen from "boxen";
import ora from "ora";
import fs from "fs/promises";

// ===== CLI Flags Parsing =====
const args = process.argv.slice(2);
let branch: string | null = null;
let showHelp = false;

// Parse CLI args
args.forEach((arg, index) => {
  if (arg === "--branch" && args[index + 1]) {
    branch = args[index + 1]!;
  }
  if (arg === "--help" || arg === "-h") {
    showHelp = true;
  }
});

if (showHelp) {
  console.log(`
${chalk.bold(
  "create-codeforge"
)} - Initialize a new project from the CodeForge template

${chalk.cyan("Usage:")}
  create-codeforge [--branch <branch>] [--help]

${chalk.cyan("Options:")}
  --branch <branch>   Specify the Git branch to use
  --help, -h          Show this help message

${chalk.cyan("Example:")}
  create-codeforge --branch dev
`);
  process.exit(0);
}

// ===== Detect Installed Package Managers =====
async function detectPackageManagers(): Promise<string[]> {
  const packageManagers = ["pnpm", "yarn", "npm"];
  const availablePMs: string[] = [];

  for (const pm of packageManagers) {
    try {
      await which(pm);
      availablePMs.push(pm);
    } catch (err) {
      console.warn(
        chalk.gray(`⚠️  ${pm} not detected: ${(err as Error).message}`)
      );
    }
  }

  return availablePMs;
}

// ===== Main CLI Execution =====
async function run() {
  console.log(chalk.bold.magenta("\n🚀 Welcome to create-codeforge CLI!\n"));

  const { projectName } = await inquirer.prompt([
    {
      type: "input",
      name: "projectName",
      message: chalk.cyan("Enter your project name:"),
      default: "my-app",
    },
  ]);

  const branchResponse = await inquirer.prompt([
    {
      type: "list",
      name: "branch",
      message: chalk.cyan("Select the branch to download from:"),
      choices: ["main", "dev", "test"],
      default: "main",
    },
  ]);
  branch = branchResponse.branch;

  const projectPath = join(process.cwd(), projectName);
  if (existsSync(projectPath)) {
    console.error(chalk.red(`❌ Folder "${projectName}" already exists.\n`));
    process.exit(1);
  }

  const spinner = ora(
    `📥 Downloading template from branch "${branch}"...`
  ).start();
  const emitter = degit(`Jack-WebDev/codeforge#${branch}`);
  await emitter.clone(projectPath);
  spinner.succeed(
    chalk.green(`✅ Template downloaded from "${branch}" branch.`)
  );

  process.chdir(projectPath);

  const { gitInit } = await inquirer.prompt([
    {
      name: "gitInit",
      type: "confirm",
      message: chalk.cyan("Do you want to initialize a git repository?"),
      default: true,
    },
  ]);

  if (gitInit) {
    const gitResult = spawnSync("git", ["init"], { stdio: "inherit" });
    if (gitResult.status === 0) {
      console.log(chalk.green("✅ Git initialized."));
    } else {
      console.log(chalk.red("❌ Git initialization failed."));
    }
  }

  const availablePMs = await detectPackageManagers();
  if (availablePMs.length === 0) {
    console.error(
      chalk.red(
        "❌ No package managers detected. Please install npm, yarn, or pnpm."
      )
    );
    process.exit(1);
  }

  let packageManager: string;

  if (availablePMs.length === 1) {
    packageManager = availablePMs[0]!;
    console.log(
      chalk.yellow(
        `🧠 Only "${packageManager}" detected. Using it automatically.`
      )
    );
  } else {
    const response = await inquirer.prompt([
      {
        name: "packageManager",
        type: "list",
        message: chalk.cyan("Choose a package manager (detected):"),
        choices: availablePMs,
      },
    ]);
    packageManager = response.packageManager;
  }

  // ===== Cleanup: Remove pnpm-specific files if not using pnpm =====
  if (packageManager !== "pnpm") {
    const filesToRemove = ["pnpm-lock.yaml", "pnpm-workspace.yaml", ".npmrc"];
    const dirsToRemove = [".pnpm"];

    // Remove files
    for (const file of filesToRemove) {
      if (existsSync(file)) {
        rmSync(file);
        console.log(
          chalk.yellow(
            `🧹 Removed ${file} for compatibility with ${packageManager}.`
          )
        );
      }
    }

    // Remove directories
    for (const dir of dirsToRemove) {
      if (existsSync(dir)) {
        rmSync(dir, { recursive: true, force: true });
        console.log(chalk.yellow(`🧹 Removed ${dir}/ directory.`));
      }
    }

    // ===== Remove packageManager field from package.json =====
    const pkgPath = join(process.cwd(), "package.json");
    try {
      const pkgRaw = await fs.readFile(pkgPath, "utf-8");
      const pkgJson = JSON.parse(pkgRaw);
      if (pkgJson.packageManager) {
        delete pkgJson.packageManager;
        await fs.writeFile(pkgPath, JSON.stringify(pkgJson, null, 2));
        console.log(
          chalk.yellow(`🧹 Removed "packageManager" field from package.json.`)
        );
      }
    } catch (err) {
      console.error(chalk.red("❌ Failed to update package.json."), err);
    }
  }

  console.log(
    chalk.cyan(`📦 Installing dependencies with ${packageManager}...`)
  );
  const installResult = spawnSync(packageManager, ["install"], {
    stdio: "inherit",
  });
  if (installResult.status !== 0) {
    console.error(chalk.red("❌ Failed to install dependencies."));
    process.exit(1);
  }

  const finalMessage = `
${chalk.green("✔ Project setup complete!")}

Next steps:
  ${chalk.cyan(`cd ${projectName}`)}
  ${chalk.cyan(`${packageManager} run build`)}
    ${chalk.cyan(`${packageManager} run dev`)}


Happy coding! 🚀
`;

  console.log(
    boxen(finalMessage, {
      padding: 1,
      margin: 1,
      borderStyle: "round",
      borderColor: "green",
    })
  );
}

run();
