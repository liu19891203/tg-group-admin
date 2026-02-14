#!/usr/bin/env node

/**
 * Telegram Group Manager - Test Runner
 * 
 * Comprehensive test execution script for all backend services,
 * API endpoints, and integration tests.
 * 
 * Usage:
 *   node run-tests.js                    # Run all tests
 *   node run-tests.js --services         # Run only service tests
 *   node run-tests.js --api             # Run only API tests
 *   node run-tests.js --verbose         # Run with verbose output
 *   node run-tests.js --coverage        # Generate coverage report
 *   node run-tests.js --watch          # Watch mode for development
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
  bold: '\x1b[1m'
};

function log(message, color = COLORS.reset) {
  console.log(`${color}${message}${COLORS.reset}`);
}

function logSection(title) {
  log('\n' + '='.repeat(60), COLORS.cyan);
  log(`  ${title}`, COLORS.bold + COLORS.cyan);
  log('='.repeat(60) + '\n', COLORS.cyan);
}

function logTestResult(suite, passed, failed, total, duration) {
  const color = failed > 0 ? COLORS.red : COLORS.green;
  log(`\n${suite}`, COLORS.bold + COLORS.yellow);
  log(`  ✓ Passed: ${passed}`, COLORS.green);
  log(`  ✗ Failed: ${failed}`, failed > 0 ? COLORS.red : COLORS.green);
  log(`  Total: ${total}`, COLORS.blue);
  log(`  Duration: ${duration}ms`, COLORS.blue);
  if (failed > 0) {
    log(`  Status: ${COLORS.red}FAILED${COLORS.reset}`);
  } else {
    log(`  Status: ${COLORS.green}PASSED${COLORS.reset}`);
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    services: false,
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
      case '--services':
      case '-s':
        options.services = true;
        break;
      case '--api':
      case '-a':
        options.api = true;
        break;
      case '--verbose':
      case '-v':
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
  log('\nTelegram Group Manager - Test Runner', COLORS.bold + COLORS.cyan);
  log('\nUsage: node run-tests.js [options]', COLORS.blue);
  log('\nOptions:', COLORS.bold);
  log('  --services, -s      Run only service tests', COLORS.reset);
  log('  --api, -a           Run only API tests', COLORS.reset);
  log('  --verbose, -v       Show verbose output', COLORS.reset);
  log('  --coverage, -c      Generate coverage report', COLORS.reset);
  log('  --watch, -w         Watch mode for development', COLORS.reset);
  log('  --grep, -g <pattern> Run tests matching pattern', COLORS.reset);
  log('  --test, -t <path>    Run specific test file', COLORS.reset);
  log('  --help, -h          Show this help message', COLORS.reset);
  log('\nExamples:', COLORS.bold);
  log('  node run-tests.js', COLORS.reset);
  log('  node run-tests.js --services --coverage', COLORS.reset);
  log('  node run-tests.js --api --verbose', COLORS.reset);
  log('  node run-tests.js --grep "should return"', COLORS.reset);
  log('  node run-tests.js --test services/verificationService.test.ts', COLORS.reset);
}

function getTestCommand(options) {
  const configPath = path.resolve(__dirname, 'tests', 'vitest.config.ts');
  
  let cmd = 'npx vitest';
  const args = [];

  if (options.services) {
    args.push(path.join(__dirname, 'tests', 'services'));
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
  
  logSection('Telegram Group Manager - Test Suite');
  log(`Running: ${cmd} ${args.join(' ')}`, COLORS.cyan);

  const startTime = Date.now();
  const child = spawn(cmd, args, {
    cwd: path.resolve(__dirname, '..'),
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'test' }
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
      log('\n✓ All tests passed!', COLORS.green + COLORS.bold);
    } else {
      log('\n✗ Some tests failed!', COLORS.red + COLORS.bold);
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
    'tests/package.json',
    'tests/vitest.config.ts',
    'tests/setup.ts'
  ];

  for (const file of requiredFiles) {
    const filePath = path.resolve(__dirname, '..', file);
    if (!fs.existsSync(filePath)) {
      log(`Missing required file: ${file}`, COLORS.red);
      return false;
    }
  }

  const packageJson = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf-8')
  );

  if (!packageJson.devDependencies?.vitest) {
    log('Vitest not found in devDependencies', COLORS.red);
    log('Please install vitest: npm install -D vitest', COLORS.yellow);
    return false;
  }

  log('All prerequisites met!', COLORS.green);
  return true;
}

async function generateSummary() {
  logSection('Test Coverage Summary');
  log('Coverage reports are generated in: coverage/', COLORS.cyan);
  log('Open coverage/index.html to view detailed coverage', COLORS.cyan);
}

async function main() {
  const options = parseArgs();

  if (options.watch && process.env.CI) {
    log('Watch mode is not available in CI environment', COLORS.red);
    process.exit(1);
  }

  const prereqsMet = await checkPrerequisites();
  if (!prereqsMet) {
    process.exit(1);
  }

  if (options.help) {
    showHelp();
    return;
  }

  if (options.coverage) {
    logSection('Coverage Mode');
    log('Generating coverage report...', COLORS.cyan);
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
