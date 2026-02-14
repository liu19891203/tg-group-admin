#!/usr/bin/env node

/**
 * Frontend Test Runner
 * 
 * Comprehensive test execution script for frontend Vue 3 application.
 * 
 * Usage:
 *   node run-tests.js                    # Run all tests
 *   node run-tests.js --views           # Run only view tests
 *   node run-tests.js --stores          # Run only store tests
 *   node run-tests.js --api             # Run only API tests
 *   node run-tests.js --verbose         # Run with verbose output
 *   node run-tests.js --coverage        # Generate coverage report
 *   node run-tests.js --watch           # Watch mode for development
 *   node run-tests.js --test <file>     # Run specific test file
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  magenta: '\x1b[35m'
};

function log(message, color = COLORS.reset) {
  console.log(`${color}${message}${COLORS.reset}`);
}

function logSection(title) {
  log('\n' + '='.repeat(70), COLORS.magenta);
  log(`  ${title}`, COLORS.bold + COLORS.magenta);
  log('='.repeat(70) + '\n', COLORS.magenta);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    views: false,
    stores: false,
    api: false,
    verbose: false,
    coverage: false,
    watch: false,
    grep: '',
    testPath: ''
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--views':
      case '-v':
        options.views = true;
        break;
      case '--stores':
      case '-s':
        options.stores = true;
        break;
      case '--api':
      case '-a':
        options.api = true;
        break;
      case '--verbose':
      case '--log':
        options.verbose = true;
        break;
      case '--coverage':
      case '-c':
        options.coverage = true;
        break;
      case '--watch':
      case '-w':
        options.watch = true;
        break;
      case '--grep':
      case '-g':
        options.grep = args[++i] || '';
        break;
      case '--test':
      case '-t':
        options.testPath = args[++i] || '';
        break;
      case '--help':
      case '-h':
        showHelp();
        process.exit(0);
      default:
        if (!arg.startsWith('--')) {
          log(`Unknown option: ${arg}`, COLORS.red);
        }
    }
  }

  return options;
}

function showHelp() {
  log('\nVue 3 Frontend Test Runner', COLORS.bold + COLORS.cyan);
  log('\nUsage: node run-tests.js [options]', COLORS.blue);
  log('\nOptions:', COLORS.bold);
  log('  --views, -v       Run only view component tests', COLORS.reset);
  log('  --stores, -s       Run only Pinia store tests', COLORS.reset);
  log('  --api, -a         Run only API service tests', COLORS.reset);
  log('  --verbose, --log   Show verbose output', COLORS.reset);
  log('  --coverage, -c     Generate coverage report', COLORS.reset);
  log('  --watch, -w        Watch mode for development', COLORS.reset);
  log('  --grep, -g <pat>  Run tests matching pattern', COLORS.reset);
  log('  --test, -t <file>  Run specific test file', COLORS.reset);
  log('  --help, -h         Show this help message', COLORS.reset);
  log('\nExamples:', COLORS.bold);
  log('  node run-tests.js', COLORS.reset);
  log('  node run-tests.js --views --coverage', COLORS.reset);
  log('  node run-tests.js --stores --verbose', COLORS.reset);
  log('  node run-tests.js --api', COLORS.reset);
  log('  node run-tests.js --grep "should login"', COLORS.reset);
  log('  node run-tests.js --test views/login.test.ts', COLORS.reset);
}

function getTestCommand(options) {
  const configPath = path.resolve(__dirname, 'tests', 'vitest.config.ts');
  
  let cmd = 'npx vitest';
  const args = [];

  if (options.views) {
    args.push(path.join(__dirname, 'tests', 'views'));
  } else if (options.stores) {
    args.push(path.join(__dirname, 'tests', 'stores'));
  } else if (options.api) {
    args.push(path.join(__dirname, 'tests', 'api'));
  } else if (options.testPath) {
    args.push(path.join(__dirname, 'tests', options.testPath));
  } else {
    args.push(path.join(__dirname, 'tests'));
  }

  if (options.watch) {
    args.push('--watch');
  } else {
    args.push('--run');
  }

  if (options.verbose) {
    args.push('--reporter=verbose');
  } else {
    args.push('--reporter=default');
  }

  if (options.coverage) {
    args.push('--coverage');
  }

  if (options.grep) {
    args.push('--testNamePattern', options.grep);
  }

  args.push('--config', configPath);

  return { cmd: 'npx', args };
}

function runTests(options) {
  const { cmd, args } = getTestCommand(options);
  
  logSection('Vue 3 Frontend Test Suite');
  log(`Running: ${cmd} ${args.join(' ')}`, COLORS.cyan);

  const startTime = Date.now();
  const child = spawn(cmd, args, {
    cwd: path.resolve(__dirname, '.'),
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'test', CI: 'true' }
  });

  let stdout = '';
  let stderr = '';

  child.stdout.on('data', (data) => {
    const text = data.toString();
    stdout += text;
    if (options.verbose) {
      process.stdout.write(text);
    }
  });

  child.stderr.on('data', (data) => {
    const text = data.toString();
    stderr += text;
    process.stderr.write(text);
  });

  child.on('close', (code) => {
    const duration = Date.now() - startTime;
    
    logSection('Test Execution Complete');
    log(`Exit Code: ${code}`, code === 0 ? COLORS.green : COLORS.red);
    log(`Total Time: ${duration}ms`, COLORS.blue);

    if (code === 0) {
      log('\n✓ All frontend tests passed!', COLORS.green + COLORS.bold);
    } else {
      log('\n✗ Some frontend tests failed!', COLORS.red + COLORS.bold);
      log('\nTo see detailed output, run with --verbose flag', COLORS.yellow);
    }

    process.exit(code);
  });

  child.on('error', (error) => {
    log(`\nFailed to run tests: ${error.message}`, COLORS.red);
    process.exit(1);
  });
}

async function checkPrerequisites() {
  log('Checking prerequisites...', COLORS.cyan);

  const requiredFiles = [
    'package.json',
    'tests/vitest.config.ts',
    'tests/setup.ts',
    'tests/views/login.test.ts',
    'tests/stores/index.test.ts'
  ];

  for (const file of requiredFiles) {
    const filePath = path.resolve(__dirname, file);
    if (!fs.existsSync(filePath)) {
      log(`Missing required file: ${file}`, COLORS.red);
      return false;
    }
  }

  const packageJson = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8')
  );

  const requiredDeps = ['vitest', '@vue/test-utils', 'jsdom', '@pinia/testing'];
  for (const dep of requiredDeps) {
    if (!packageJson.devDependencies?.[dep]) {
      log(`Missing dev dependency: ${dep}`, COLORS.red);
      log(`Please install: npm install -D ${dep}`, COLORS.yellow);
      return false;
    }
  }

  log('All prerequisites met!', COLORS.green);
  return true;
}

function printTestSummary() {
  logSection('Test Categories');
  log('  📄 Views Tests', COLORS.blue);
  log('     - Login view component tests', COLORS.reset);
  log('     - Dashboard view component tests', COLORS.reset);
  log('     - Group management tests', COLORS.reset);
  log('     - Member management tests', COLORS.reset);
  log('  🗃️  Stores Tests', COLORS.blue);
  log('     - Auth store tests', COLORS.reset);
  log('     - Groups store tests', COLORS.reset);
  log('     - Members store tests', COLORS.reset);
  log('     - Points store tests', COLORS.reset);
  log('     - Notifications store tests', COLORS.reset);
  log('  🔌 API Tests', COLORS.blue);
  log('     - Groups API endpoint tests', COLORS.reset);
  log('     - Members API endpoint tests', COLORS.reset);
  log('     - Auth API endpoint tests', COLORS.reset);
  log('     - Stats API endpoint tests', COLORS.reset);
  log('     - Lottery API endpoint tests', COLORS.reset);
  log('     - Auto replies API tests', COLORS.reset);
  log('     - Scheduled messages API tests', COLORS.reset);
  log('     - Crypto API tests', COLORS.reset);
}

async function main() {
  const options = parseArgs();

  if (options.watch && process.env.CI) {
    log('Watch mode is not available in CI environment', COLORS.red);
    process.exit(1);
  }

  if (options.help) {
    showHelp();
    return;
  }

  const prereqsMet = await checkPrerequisites();
  if (!prereqsMet) {
    process.exit(1);
  }

  printTestSummary();

  if (options.coverage) {
    logSection('Coverage Mode');
    log('Generating frontend coverage report...', COLORS.cyan);
  }

  try {
    await runTests(options);
  } catch (error) {
    log(`Error running tests: ${error.message}`, COLORS.red);
    process.exit(1);
  }
}

main().catch((error) => {
  log(`Unhandled error: ${error.message}`, COLORS.red);
  process.exit(1);
});
