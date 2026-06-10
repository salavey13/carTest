#!/usr/bin/env node
/**
 * Installer Creator Skill — Self-Extracting Format
 *
 * Creates installer files following the install.mjs pattern:
 * 1. Instructions at top telling agent to stop and extract next code block
 * 2. Code block with install script that reads itself and extracts files
 * 3. File markers "// /path/to/file.ext" followed by code blocks
 *
 * Usage:
 *   create-installer --source <dir> --output <file>
 *   install <installer-file> [--target <dir>]
 *   list <installer-file>
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  dim: '\x1b[2m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logError(message) {
  log(`ERROR: ${message}`, 'red');
}

function logSuccess(message) {
  log(`✓ ${message}`, 'green');
}

function logInfo(message) {
  log(`ℹ ${message}`, 'cyan');
}

function logWarning(message) {
  log(`⚠ ${message}`, 'yellow');
}

/**
 * Detect file language from extension
 */
function detectLanguage(filename) {
  const ext = path.extname(filename).toLowerCase();
  const langMap = {
    '.js': 'javascript',
    '.mjs': 'javascript',
    '.cjs': 'javascript',
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.jsx': 'javascript',
    '.json': 'json',
    '.md': 'markdown',
    '.sh': 'bash',
    '.bash': 'bash',
    '.py': 'python',
    '.rs': 'rust',
    '.go': 'go',
    '.java': 'java',
    '.c': 'c',
    '.cpp': 'cpp',
    '.h': 'c',
    '.hpp': 'cpp',
    '.css': 'css',
    '.scss': 'scss',
    '.sass': 'scss',
    '.html': 'html',
    '.xml': 'xml',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.toml': 'toml',
    '.sql': 'sql',
    '.txt': 'text',
    '.graphql': 'graphql',
    '.gql': 'graphql'
  };
  return langMap[ext] || 'text';
}

/**
 * Read the existing install.mjs template to use as base
 */
function getInstallScript() {
  const installPath = path.join(__dirname, '../docs/skill_installer/install.mjs');
  if (fs.existsSync(installPath)) {
    let script = fs.readFileSync(installPath, 'utf-8');
    // Modify the script to read itself (the installer file) instead of a separate source file
    // Replace the sourceFile default to use __filename
    script = script.replace(
      "const sourceFile = process.argv[2] || './zai_agent_doc_src.txt';",
      "const sourceFile = process.argv[2] || require('url').fileURLToPath(import.meta.url);"
    );
    // Replace targetDir to default to skills directory
    script = script.replace(
      "const targetDir  = process.argv[3] || '.';",
      "const targetDir  = process.argv[3] || './skills/';"
    );
    return script;
  }
  // If install.mjs doesn't exist, throw an error
  throw new Error('install.mjs not found at ' + installPath);
}

/**
 * Collect all files from source directory
 */
function collectFiles(sourceDir) {
  const files = [];

  function walkDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // Skip common ignore directories
        if (!['node_modules', '.git', '.next', 'dist', 'build', 'coverage', '.claude'].includes(entry.name)) {
          walkDir(fullPath);
        }
      } else {
        const relPath = path.relative(sourceDir, fullPath);
        files.push({ path: fullPath, relPath });
      }
    }
  }

  walkDir(sourceDir);
  return files;
}

/**
 * Create installer file following the install.mjs pattern
 */
async function createInstaller(sourceDir, outputFile, options = {}) {
  const { name, description, version = '1.0.0', dryRun = false } = options;

  logInfo(`Creating installer from: ${sourceDir}`);
  logInfo(`Output file: ${outputFile}`);

  if (!fs.existsSync(sourceDir)) {
    logError(`Source directory does not exist: ${sourceDir}`);
    return false;
  }

  const files = collectFiles(sourceDir);

  if (files.length === 0) {
    logError('No files found in source directory');
    return false;
  }

  logInfo(`Found ${files.length} file(s) to package`);

  const installerName = name || path.basename(sourceDir);
  const timestamp = new Date().toISOString();

  // Build installer content
  let content = '';

  // Header with metadata
  content += `# ${installerName}\n`;
  content += `# Self-extracting skill installer\n`;
  content += `# Version: ${version}\n`;
  content += `# Created: ${timestamp}\n`;
  content += `# Files: ${files.length}\n`;
  if (description) {
    content += `# Description: ${description}\n`;
  }
  content += `\n`;

  // Installation instructions for agent
  content += `---\n`;
  content += `\n`;
  content += `## 🚀 Installation Instructions\n`;
  content += `\n`;
  content += `**ATTENTION AGENT**: When you read this file, follow these steps exactly:\n`;
  content += `\n`;
  content += `1. **STOP READING THIS FILE NOW** - Do not read further!\n`;
  content += `2. **Extract the next code block** and save it as a temporary file\n`;
  content += `3. **Run the extracted script** on this file to extract all skill files\n`;
  content += `4. The script will create the proper directory structure and extract all files\n`;
  content += `\n`;
  content += `### Command to run:\n`;
  content += `\`\`\`bash\n`;
  content += `# Extract install script from next code block and run:\n`;
  content += `node /tmp/install-${Date.now()}.mjs [target-dir]\n`;
  content += `\`\`\`\n`;
  content += `\n`;
  content += `---\n`;
  content += `\n`;

  // Install script (first code block)
  const installScript = getInstallScript();
  content += `\`\`\`javascript\n`;
  content += installScript;
  content += `\`\`\`\n`;
  content += `\n`;
  content += `---\n`;
  content += `\n`;
  content += `## 📦 Skill Files\n`;
  content += `\n`;
  content += `**DO NOT READ FURTHER** - Extract and run the install script first!\n`;
  content += `\n`;
  content += `The files below will be extracted by the install script:\n`;
  content += `\n`;
  content += `---\n`;
  content += `\n`;

  // File markers and code blocks
  for (const file of files) {
    const fileContent = fs.readFileSync(file.path, 'utf-8');
    const lang = detectLanguage(file.relPath);

    // File marker - MUST start with / for install.mjs pattern
    content += `// /${file.relPath}\n`;
    // Code block
    content += `\`\`\`${lang}\n`;
    content += fileContent;
    // Ensure file ends with newline before closing fence
    if (!fileContent.endsWith('\n')) {
      content += '\n';
    }
    content += `\`\`\`\n`;
    content += `\n`;
  }

  if (dryRun) {
    logWarning('Dry-run mode: not writing file');
    logInfo(`Installer size would be: ${(content.length / 1024).toFixed(1)} KB`);
    return true;
  }

  // Write installer file
  fs.writeFileSync(outputFile, content, 'utf-8');

  logSuccess(`Installer created: ${outputFile}`);
  logInfo(`Size: ${(content.length / 1024).toFixed(1)} KB`);
  logInfo(`Skill: ${installerName}`);
  logInfo(`Version: ${version}`);
  logInfo(`Files: ${files.length}`);

  return true;
}

/**
 * Parse installer file to list contents
 */
function parseInstaller(installerFile) {
  const content = fs.readFileSync(installerFile, 'utf-8');
  const lines = content.split('\n');

  const metadata = {};
  const files = [];

  let inCodeBlock = false;
  let currentFile = null;
  let currentContent = [];
  let afterInstallScript = false;
  let dashCount = 0;
  let codeBlockCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Parse metadata from header
    if (line.startsWith('# ') && !inCodeBlock) {
      const match = line.match(/^#\s+(\w+):\s*(.+)$/);
      if (match) {
        const [, key, value] = match;
        metadata[key.toLowerCase()] = value;
      }
    }

    // Track when we've passed the install script by counting --- separators
    // The first --- is after instructions, the second --- is after install script
    if (line.trim() === '---' && !inCodeBlock) {
      dashCount++;
      // After we've seen 2 --- separators, we're at the file section
      if (dashCount >= 2) {
        afterInstallScript = true;
      }
      continue;
    }

    // Count code blocks to know when we've passed the install script
    if (line.trim().startsWith('```')) {
      codeBlockCount++;
      // The install script is the first code block
      // Files start after code block 2 closes (first is install script, second closes it)
      // Actually, let's use a simpler approach
    }

    // File marker pattern: // /path/to/file.ext
    const markerMatch = line.match(/^\/\/\s+(\/\S+\.\S+)\s*$/);
    if (markerMatch && afterInstallScript && !inCodeBlock) {
      currentFile = markerMatch[1];
      currentContent = [];
      continue;
    }

    // Code block handling
    if (line.trim().startsWith('```')) {
      if (!inCodeBlock) {
        // Opening fence - check if this follows a file marker
        inCodeBlock = true;
      } else {
        // Closing fence
        if (currentFile && currentContent.length > 0) {
          files.push({
            path: currentFile,
            content: currentContent.join('\n'),
            size: currentContent.join('\n').length
          });
        }
        currentFile = null;
        currentContent = [];
        inCodeBlock = false;
      }
      continue;
    }

    if (inCodeBlock && currentFile) {
      currentContent.push(line);
    }
  }

  return { metadata, files };
}

/**
 * Install from installer file
 */
async function installFromInstaller(installerFile, targetDir, options = {}) {
  const { dryRun = false } = options;

  logInfo(`Installing from: ${installerFile}`);

  if (!fs.existsSync(installerFile)) {
    logError(`Installer file does not exist: ${installerFile}`);
    return false;
  }

  const { metadata, files } = parseInstaller(installerFile);

  logSuccess(`Installer: ${metadata.installer || 'Unknown'} v${metadata.version || 'unknown'}`);
  logInfo(`Files: ${files.length}`);

  if (dryRun) {
    logWarning('Dry-run mode: would create these files:');
    for (const file of files) {
      log(`  ${path.join(targetDir, file.path)} (${(file.size / 1024).toFixed(1)} KB)`);
    }
    return true;
  }

  // Create target directory
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Extract files
  let extracted = 0;
  let skipped = 0;

  for (const file of files) {
    const outPath = path.join(targetDir, file.path);
    const dir = path.dirname(outPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Check if file already exists with same content
    if (fs.existsSync(outPath)) {
      const existing = fs.readFileSync(outPath, 'utf-8');
      if (existing === file.content) {
        log(`  [SKIP] ${file.path} (identical)`, 'dim');
        skipped++;
        continue;
      }
    }

    fs.writeFileSync(outPath, file.content, 'utf-8');
    log(`  ✅ ${file.path} (${(file.size / 1024).toFixed(1)} KB)`, 'green');
    extracted++;
  }

  log('');
  logSuccess(`Done: ${extracted} files extracted, ${skipped} skipped`);
  logInfo(`Target: ${path.resolve(targetDir)}`);

  return true;
}

/**
 * List contents of installer file
 */
function listInstaller(installerFile) {
  logInfo(`Listing: ${installerFile}`);

  if (!fs.existsSync(installerFile)) {
    logError(`Installer file does not exist: ${installerFile}`);
    return false;
  }

  const { metadata, files } = parseInstaller(installerFile);

  // Display metadata
  log('', 'dim');
  log('Installer Metadata:', 'cyan');
  log(`  Name: ${metadata.installer || 'Unknown'}`, 'white');
  log(`  Version: ${metadata.version || 'Unknown'}`, 'white');
  log(`  Created: ${metadata.created || 'Unknown'}`, 'white');
  if (metadata.description) {
    log(`  Description: ${metadata.description}`, 'white');
  }
  log('', 'dim');

  // List files
  log(`Files (${files.length}):`, 'cyan');
  for (const file of files) {
    const ext = path.extname(file.path);
    const lang = detectLanguage(file.path);
    log(`  [${lang.padEnd(12)}] ${file.path} (${(file.size / 1024).toFixed(1)} KB)`, 'white');
  }

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  log('', 'dim');
  logSuccess(`Total: ${files.length} file(s), ${(totalSize / 1024).toFixed(1)} KB`);

  return true;
}

/**
 * CLI interface
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    printUsage();
    process.exit(1);
  }

  const command = args[0];
  const cmdArgs = args.slice(1);

  // Parse flags
  const flags = {
    'source': null,
    'output': null,
    'target': null,
    'name': null,
    'description': null,
    'version': null,
    'dry-run': false,
    'help': false
  };

  for (let i = 0; i < cmdArgs.length; i++) {
    const arg = cmdArgs[i];
    if (arg.startsWith('--')) {
      const flagName = arg.slice(2);
      if (flagName === 'dry-run' || flagName === 'n') {
        flags['dry-run'] = true;
      } else if (flagName === 'help' || flagName === 'h') {
        flags['help'] = true;
      } else if (cmdArgs[i + 1] && !cmdArgs[i + 1].startsWith('--')) {
        flags[flagName] = cmdArgs[i + 1];
        i++;
      } else {
        flags[flagName] = true;
      }
    }
  }

  if (flags['help']) {
    printUsage(command);
    process.exit(0);
  }

  switch (command) {
    case 'create-installer': {
      const sourceDir = flags['source'];
      const outputFile = flags['output'];

      if (!sourceDir || !outputFile) {
        logError('create-installer requires --source and --output');
        printUsage('create-installer');
        process.exit(1);
      }

      const success = await createInstaller(sourceDir, outputFile, {
        dryRun: flags['dry-run'],
        name: flags['name'],
        description: flags['description'],
        version: flags['version']
      });

      process.exit(success ? 0 : 1);
    }

    case 'install': {
      const installerFile = cmdArgs.find(a => !a.startsWith('--'));
      const targetDir = flags['target'] || './skills/';

      if (!installerFile) {
        logError('install requires an installer file path');
        printUsage('install');
        process.exit(1);
      }

      const success = await installFromInstaller(installerFile, targetDir, {
        dryRun: flags['dry-run']
      });

      process.exit(success ? 0 : 1);
    }

    case 'list': {
      const installerFile = cmdArgs.find(a => !a.startsWith('--'));

      if (!installerFile) {
        logError('list requires an installer file path');
        printUsage('list');
        process.exit(1);
      }

      const success = listInstaller(installerFile);
      process.exit(success ? 0 : 1);
    }

    default:
      logError(`Unknown command: ${command}`);
      printUsage();
      process.exit(1);
  }
}

function printUsage(command = null) {
  const commands = {
    'create-installer': `Usage: installer-creator-skill.mjs create-installer --source <dir> --output <file> [options]

Options:
  --source <dir>      Source directory containing skill files
  --output <file>     Output installer file path (.md or .huge)
  --name <name>       Skill name (default: basename of source dir)
  --description <txt> Description of the skill
  --version <ver>     Version string (default: 1.0.0)
  --dry-run, -n       Show what would be done without creating files
  --help, -h          Show this help message

Example:
  node scripts/installer-creator-skill.mjs create-installer \\
    --source ./skills/boss-mode \\
    --output ./boss-mode.installer.md \\
    --name "BOSS MODE" \\
    --description "Multi-agent quest orchestration system" \\
    --version "1.0.0"
`,
    'install': `Usage: installer-creator-skill.mjs install <installer-file> [--target <dir>] [options]

Arguments:
  installer-file      Path to the installer file

Options:
  --target <dir>      Target directory (default: ./skills/)
  --dry-run, -n       Show what would be done without creating files
  --help, -h          Show this help message

Example:
  node scripts/installer-creator-skill.mjs install boss-mode.installer.md ./skills/
`,
    'list': `Usage: installer-creator-skill.mjs list <installer-file> [--help]

Arguments:
  installer-file      Path to the installer file

Options:
  --help, -h         Show this help message

Example:
  node scripts/installer-creator-skill.mjs list boss-mode.installer.md
`
  };

  if (command && commands[command]) {
    log(commands[command], 'cyan');
  } else {
    log(`Installer Creator Skill — Self-Extracting Format`, 'cyan');
    log('', 'reset');
    log(`Create installer files that extract themselves when run.`, 'white');
    log(`Uses the install.mjs pattern with // /path/file.ext markers.`, 'dim');
    log('', 'reset');
    log(`Commands:`, 'cyan');
    log(`  create-installer  Create an installer file from a directory`, 'white');
    log(`  install           Install from an installer file`, 'white');
    log(`  list              List contents of an installer file`, 'white');
    log('', 'reset');
    log(`Use --help with any command for detailed usage.`, 'dim');
  }
}

// Run CLI if executed directly
if (import.meta.url === `file://${process.argv[1]}` ||
    process.argv[1].endsWith('installer-creator-skill.mjs')) {
  main().catch(err => {
    logError(err.message);
    process.exit(1);
  });
}

export { createInstaller, installFromInstaller, listInstaller, parseInstaller };
