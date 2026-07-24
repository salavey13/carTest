#!/usr/bin/env node
/**
 * BOSS MODE — Dream Decomposition into Quest Chains
 *
 * The BOSS role receives dreams and decomposes them into SupaPlan tasks.
 * This is the strategic architect role — no code execution, only planning.
 *
 * Usage:
 *   node skills/boss-mode/boss.mjs decompose --dream "..." --player "alex" --questChainId "..." --difficulty "epic"
 *   node skills/boss-mode/boss.mjs suggest-next --taskId <uuid>
 *   node skills/boss-mode/boss.mjs create-tasks --plan <plan-file>
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function getArg(name, fallback = undefined) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  return process.argv[idx + 1];
}

function required(value, message) {
  if (!value) throw new Error(message);
  return value;
}

function getAdminClient() {
  // Accept both NEXT_PUBLIC_SUPABASE_URL (Next.js convention) and SUPABASE_URL
  // (shorter alias used in .env files). Also accept NEXT_PUBLIC_SUPABASE_URL
  // as a fallback for environments that only set the public var.
  const url = required(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
    'Missing NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL alias). Set one in .env or export it before running.'
  );
  const key = required(process.env.SUPABASE_SERVICE_ROLE_KEY, 'Missing SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * Difficulty levels and their implications
 */
const DIFFICULTY_LEVELS = {
  easy: {
    doors: 3,
    parallelism: 'low',
    estimatedTotalHours: 4,
    description: 'Quick wins, straightforward implementation'
  },
  medium: {
    doors: 5,
    parallelism: 'medium',
    estimatedTotalHours: 12,
    description: 'Some complexity, requires planning'
  },
  epic: {
    doors: 8,
    parallelism: 'high',
    estimatedTotalHours: 40,
    description: 'Major undertaking, strategic thinking required'
  }
};

/**
 * Dream validation — check if achievable with current stack
 */
function validateDream(dream, stack = ['Next.js', 'Supabase', 'Telegram']) {
  const redFlags = [
    'blockchain', 'smart contract', 'web3',
    'machine learning', 'ai training', 'model fine-tuning',
    'mobile app', 'ios', 'android native',
    'real-time video', 'webrtc', 'streaming',
    '3d rendering', 'unity', 'unreal'
  ];

  const dreamLower = dream.toLowerCase();
  const foundFlags = redFlags.filter(flag => dreamLower.includes(flag));

  return {
    achievable: foundFlags.length === 0,
    warnings: foundFlags,
    recommendation: foundFlags.length > 0
      ? `Dream may require additional expertise: ${foundFlags.join(', ')}`
      : 'Dream aligns well with current stack'
  };
}

/**
 * Decompose dream into quest doors
 * Returns array of door definitions
 */
function decomposeDream(dream, options = {}) {
  const {
    player = 'anonymous',
    questChainId = randomUUID(),
    difficulty = 'medium',
    tags = [],
    existingCapabilities = []
  } = options;

  const validation = validateDream(dream);
  if (!validation.achievable) {
    console.warn(`⚠️  Dream validation warnings:`, validation.warnings);
  }

  const level = DIFFICULTY_LEVELS[difficulty] || DIFFICULTY_LEVELS.medium;
  const doors = [];

  // Analyze dream for key themes
  const themes = extractThemes(dream);

  // Generate doors based on themes and difficulty
  for (let i = 0; i < level.doors; i++) {
    const door = generateDoor(i, themes, {
      position: i + 1,
      total: level.doors,
      questChainId,
      player,
      difficulty,
      existingCapabilities
    });
    doors.push(door);
  }

  // Set up dependencies (requires/unlocks)
  setupDependencies(doors, level.parallelism);

  return {
    questChainId,
    dreamName: extractDreamName(dream),
    difficulty,
    doors,
    validation,
    estimatedHours: level.estimatedTotalHours,
    themes
  };
}

/**
 * Extract key themes from dream description
 */
function extractThemes(dream) {
  const themePatterns = {
    'authentication': ['auth', 'login', 'user', 'session', 'oauth'],
    'database': ['database', 'storage', 'data', 'persist', 'query'],
    'api': ['api', 'endpoint', 'rest', 'graphql', 'backend'],
    'ui': ['ui', 'frontend', 'component', 'interface', 'design'],
    'integration': ['integration', 'webhook', 'external', 'third-party'],
    'testing': ['test', 'spec', 'coverage', 'qa'],
    'deployment': ['deploy', 'ci/cd', 'build', 'release'],
    'monitoring': ['monitor', 'log', 'analytics', 'tracking']
  };

  const found = [];
  const dreamLower = dream.toLowerCase();

  for (const [theme, keywords] of Object.entries(themePatterns)) {
    if (keywords.some(kw => dreamLower.includes(kw))) {
      found.push(theme);
    }
  }

  return found.length > 0 ? found : ['core'];
}

/**
 * Extract a short, memorable name for the dream
 */
function extractDreamName(dream) {
  // Look for key nouns and phrases
  const words = dream.match(/\b[A-Z][a-z]+\b/g) || [];
  if (words.length >= 2) {
    return words.slice(0, 3).join('-');
  }

  // Fallback to truncated description
  return dream.split(' ').slice(0, 3).join('-').toLowerCase();
}

/**
 * Generate a single quest door
 */
function generateDoor(index, themes, options) {
  const { position, total, questChainId, player, difficulty, existingCapabilities } = options;

  const doorTemplates = {
    core: {
      title: 'Core Implementation',
      capability: 'core',
      polish: 'Build the core functionality. Focus on solid architecture, clean code, and proper error handling.'
    },
    authentication: {
      title: 'Authentication Gateway',
      capability: 'auth',
      polish: 'Implement secure user authentication with session management. Focus on edge cases: expired tokens, concurrent logins, password reset flows.'
    },
    database: {
      title: 'Data Layer Architecture',
      capability: 'database',
      polish: 'Design and implement the data model. Consider: indexing strategy, RLS policies, migration path, backup/recovery procedures.'
    },
    api: {
      title: 'API Core',
      capability: 'api',
      polish: 'Build clean, well-documented API endpoints. Consider: rate limiting, error handling, versioning, testing strategy.'
    },
    ui: {
      title: 'User Interface',
      capability: 'ui',
      polish: 'Create intuitive, responsive UI components. Focus on: accessibility, loading states, error messages, mobile experience.'
    },
    integration: {
      title: 'External Integrations',
      capability: 'integration',
      polish: 'Connect with external services. Handle: auth flows, rate limits, fallback strategies, error recovery.'
    },
    testing: {
      title: 'Test Coverage',
      capability: 'testing',
      polish: 'Establish comprehensive test suite. Include: unit tests, integration tests, edge cases, performance benchmarks.'
    },
    deployment: {
      title: 'Production Ready',
      capability: 'deployment',
      polish: 'Set up CI/CD pipeline. Consider: environment configs, rollback procedures, monitoring, health checks.'
    },
    monitoring: {
      title: 'Observability',
      capability: 'monitoring',
      polish: 'Implement logging and analytics. Track: key metrics, error rates, user behavior, performance indicators.'
    }
  };

  // Pick a theme for this door
  const theme = themes[index % themes.length] || 'core';
  const template = doorTemplates[theme] || doorTemplates.core;

  // Add position-specific flavor
  const positionFlavor = getPositionFlavor(position, total);

  return {
    id: randomUUID(),
    title: `${template.title} ${position > 1 ? `(${position}/${total})` : ''}`,
    capability: template.capability,
    polishInstructions: `${template.polish}\n\n${positionFlavor}`,
    tags: [...themes, theme, difficulty],
    difficulty,
    position,
    total,
    questChainId,
    player,
    suggestedBy: 'boss',
    spoilPreview: generateSpoilPreview(theme, position, total)
  };
}

/**
 * Get position-specific flavor text
 */
function getPositionFlavor(position, total) {
  if (position === 1) {
    return 'This is the foundation — build it solid and everything else will be easier.';
  }
  if (position === total) {
    return 'The final piece — polish it until it shines, then step back and admire the complete system.';
  }
  if (position === Math.ceil(total / 2)) {
    return 'We\'re in the thick of it now — this connects everything together.';
  }
  return 'Keep the momentum going — each door brings us closer to the dream.';
}

/**
 * Generate curiosity hook for door
 */
function generateSpoilPreview(theme, position, total) {
  const previews = {
    authentication: 'The gatekeeper awaits — will it recognize friend or foe?',
    database: 'The foundations must support the weight of ambition...',
    api: 'Commands will flow like water — but will they obey?',
    ui: 'The face of your dream — will it smile at first sight?',
    integration: 'The world awaits connection — can you bridge the divide?',
    testing: 'Confidence comes from knowing — what will the tests reveal?',
    deployment: 'The moment of truth — will it survive the real world?',
    monitoring: 'The logs remember everything — even what you deleted...'
  };

  return previews[theme] || 'Something new awaits behind this door...';
}

/**
 * Set up dependency graph (requires/unlocks)
 */
function setupDependencies(doors, parallelism) {
  const parallelismLevels = {
    low: 1,    // Fully sequential
    medium: 2, // Some parallel work
    high: 3     // Highly parallel
  };

  const maxParallel = parallelismLevels[parallelism] || 2;

  doors.forEach((door, index) => {
    // First door has no requirements
    if (index === 0) {
      door.requires = [];
      door.unlocks = doors.slice(1, 1 + maxParallel).map(d => d.id);
      return;
    }

    // Middle doors require previous ones
    const requiresStart = Math.max(0, index - maxParallel);
    door.requires = doors.slice(requiresStart, index).map(d => d.id);

    // Unlock next doors
    const unlockEnd = Math.min(doors.length, index + 1 + maxParallel);
    door.unlocks = doors.slice(index + 1, unlockEnd).map(d => d.id);
  });

  // Last door unlocks nothing
  doors[doors.length - 1].unlocks = [];
}

/**
 * Create SupaPlan tasks from door definitions
 */
async function createSupabaseTasks(doors, supabase) {
  const tasks = [];
  const now = new Date().toISOString();

  for (const door of doors) {
    const task = {
      id: door.id,
      title: door.title,
      capability: door.capability,
      status: 'open',
      body: door.polishInstructions,
      todo_path: null, // Will be set if needed
      metadata: {
        quest_chain_id: door.questChainId,
        chain_position: door.position,
        polish_instructions: door.polishInstructions,
        player: door.player,
        dream_name: extractDreamName(door.title),
        difficulty: door.difficulty,
        tags: door.tags,
        suggested_by: door.suggestedBy,
        requires: door.requires,
        unlocks: door.unlocks,
        spoil_preview: door.spoilPreview
      },
      created_at: now,
      updated_at: now
    };

    const { data, error } = await supabase
      .from('supaplan_tasks')
      .insert(task)
      .select()
      .maybeSingle();

    if (error) {
      console.error(`❌ Failed to create task: ${door.title}`, error);
      continue;
    }

    tasks.push(data);
  }

  return tasks;
}

/**
 * Main decompose command
 */
async function decomposeCommand() {
  const dream = required(getArg('dream'), 'Missing --dream');
  const player = getArg('player', 'anonymous');
  const questChainId = getArg('questChainId') || randomUUID();
  const difficulty = getArg('difficulty', 'medium');
  const dryRun = process.argv.includes('--dry-run');

  console.log(`🎭 BOSS MODE: Dream Decomposition\n`);
  console.log(`📝 Dream: ${dream}`);
  console.log(`👤 Player: ${player}`);
  console.log(`🔑 Quest Chain: ${questChainId}`);
  console.log(`⭐ Difficulty: ${difficulty}\n`);

  // Validate
  const validation = validateDream(dream);
  console.log(`✅ Validation: ${validation.recommendation}\n`);

  // Decompose
  const decomposition = decomposeDream(dream, {
    player,
    questChainId,
    difficulty
  });

  console.log(`🎯 Decomposed into ${decomposition.doors.length} doors:\n`);

  decomposition.doors.forEach((door, i) => {
    console.log(`${i + 1}. ${door.title}`);
    console.log(`   Capability: ${door.capability}`);
    console.log(`   Spoiler: ${door.spoilPreview}`);
    console.log(`   Requires: ${door.requires.length} prerequisite(s)`);
    console.log(`   Unlocks: ${door.unlocks.length} door(s)\n`);
  });

  console.log(`📊 Estimate: ${decomposition.estimatedHours} hours total`);
  console.log(`🏷️  Themes: ${decomposition.themes.join(', ')}\n`);

  if (dryRun) {
    console.log('🔍 DRY RUN — No tasks created in Supabase');
    return;
  }

  // Create tasks in Supabase
  console.log(`💾 Creating tasks in Supabase...\n`);

  const supabase = getAdminClient();
  const tasks = await createSupabaseTasks(decomposition.doors, supabase);

  console.log(`✅ Created ${tasks.length} tasks in Supabase\n`);
  console.log(`🚀 Quest chain "${decomposition.dreamName}" is ready!`);
  console.log(`🔑 First task ID: ${decomposition.doors[0].id}`);
  console.log(`\n📮 Send INVITE notification to player with cheatcode!\n`);
}

/**
 * Suggest next doors after task completion
 */
async function suggestNextCommand() {
  const taskId = required(getArg('taskId'), 'Missing --taskId');

  const supabase = getAdminClient();

  // Get current task
  const { data: currentTask, error } = await supabase
    .from('supaplan_tasks')
    .select('*')
    .eq('id', taskId)
    .maybeSingle();

  if (error || !currentTask) {
    console.error('❌ Task not found');
    process.exit(1);
  }

  const questChainId = currentTask.metadata?.quest_chain_id;
  if (!questChainId) {
    console.error('❌ Task is not part of a quest chain');
    process.exit(1);
  }

  // Get unlocked tasks (boss-created, open status)
  const { data: unlockedTasks } = await supabase
    .from('supaplan_tasks')
    .select('*')
    .eq('metadata->>quest_chain_id', questChainId)
    .eq('status', 'open')
    .contains('metadata->>requires', taskId)
    .order('created_at', { ascending: true });

  if (!unlockedTasks || unlockedTasks.length === 0) {
    console.log('🎉 Quest chain complete! No more doors unlocked.');
    return;
  }

  // Rank by relevance
  const ranked = unlockedTasks.slice(0, 3).map(task => ({
    id: task.id,
    title: task.title,
    spoiler: task.metadata?.spoil_preview || '...',
    capability: task.capability
  }));

  console.log(`🚪 Next doors unlocked by ${currentTask.title}:\n`);

  ranked.forEach((door, i) => {
    const emojis = ['🔴', '🔵', '🟢'];
    console.log(`${emojis[i]} ${door.title}`);
    console.log(`   💬 ${door.spoiler}`);
    console.log(`   🔑 ${door.id}\n`);
  });
}

/**
 * Plan mode — generate plan file without creating tasks
 */
async function planCommand() {
  const dream = required(getArg('dream'), 'Missing --dream');
  const outputFile = getArg('output');

  const decomposition = decomposeDream(dream, {
    player: getArg('player', 'anonymous'),
    questChainId: randomUUID(),
    difficulty: getArg('difficulty', 'medium')
  });

  const plan = {
    questChainId: decomposition.questChainId,
    dreamName: decomposition.dreamName,
    dream,
    difficulty: decomposition.difficulty,
    estimatedHours: decomposition.estimatedHours,
    doors: decomposition.doors.map(door => ({
      title: door.title,
      capability: door.capability,
      polishInstructions: door.polishInstructions,
      tags: door.tags,
      spoilPreview: door.spoilPreview,
      requires: door.requires,
      unlocks: door.unlocks
    }))
  };

  if (outputFile) {
    const fs = await import('node:fs');
    fs.writeFileSync(outputFile, JSON.stringify(plan, null, 2));
    console.log(`📝 Plan saved to: ${outputFile}`);
  } else {
    console.log(JSON.stringify(plan, null, 2));
  }
}

// CLI entry point
const [command] = process.argv.slice(2);

const commands = {
  'decompose': decomposeCommand,
  'suggest-next': suggestNextCommand,
  'plan': planCommand
};

if (!commands[command]) {
  console.error('Usage: node skills/boss-mode/boss.mjs <command> [options]');
  console.error('');
  console.error('Commands:');
  console.error('  decompose --dream "..." [--player "name"] [--questChainId "id"] [--difficulty easy|medium|epic] [--dry-run]');
  console.error('  suggest-next --taskId <uuid>');
  console.error('  plan --dream "..." [--output file.json] [--difficulty easy|medium|epic]');
  process.exit(1);
}

commands[command]().catch(err => {
  console.error(err);
  process.exit(1);
});
