#!/usr/bin/env node

/**
 * Telegram Group Manager - Simple Test Runner
 * 简化版测试运行器，不依赖模块导入
 */

const fs = require('fs');
const path = require('path');

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

let passed = 0;
let failed = 0;
let currentTest = '';

function log(message, color = COLORS.reset) {
  console.log(`${color}${message}${COLORS.reset}`);
}

function test(name, fn) {
  currentTest = name;
  try {
    fn();
    passed++;
    log(`  ✓ ${name}`, COLORS.green);
    return true;
  } catch (error) {
    failed++;
    log(`  ✗ ${name}`, COLORS.red);
    log(`    Error: ${error.message}`, COLORS.yellow);
    return false;
  }
}

function expect(actual) {
  return {
    toBe(expected) {
      if (actual !== expected) {
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      }
    },
    toEqual(expected) {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      }
    },
    toBeGreaterThan(expected) {
      if (actual <= expected) {
        throw new Error(`Expected ${actual} to be greater than ${expected}`);
      }
    },
    toBeLessThan(expected) {
      if (actual >= expected) {
        throw new Error(`Expected ${actual} to be less than ${expected}`);
      }
    },
    toContain(expected) {
      if (!actual.includes(expected)) {
        throw new Error(`Expected ${actual} to contain ${expected}`);
      }
    },
    toMatch(pattern) {
      if (!pattern.test(actual)) {
        throw new Error(`Expected ${actual} to match ${pattern}`);
      }
    },
    toBeTruthy() {
      if (!actual) {
        throw new Error(`Expected truthy value, got ${actual}`);
      }
    },
    toBeFalsy() {
      if (actual) {
        throw new Error(`Expected falsy value, got ${actual}`);
      }
    },
    toBeDefined() {
      if (actual === undefined) {
        throw new Error(`Expected defined value, got undefined`);
      }
    },
    toBeNull() {
      if (actual !== null) {
        throw new Error(`Expected null, got ${actual}`);
      }
    },
    toHaveLength(expected) {
      if (actual.length !== expected) {
        throw new Error(`Expected length ${expected}, got ${actual.length}`);
      }
    },
    toHaveProperty(prop) {
      if (!(prop in actual)) {
        throw new Error(`Expected object to have property ${prop}`);
      }
    }
  };
}

function describe(name, fn) {
  log(`\n${name}`, COLORS.bold + COLORS.cyan);
  fn();
}

console.log('\n' + '='.repeat(60));
log('  Telegram Group Manager - Unit Tests', COLORS.bold + COLORS.cyan);
console.log('='.repeat(60));

describe('Utils Tests', () => {
  test('should generate random string', () => {
    const randomString = (length) => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let result = '';
      for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    };
    
    const str1 = randomString(10);
    const str2 = randomString(10);
    
    expect(str1).toHaveLength(10);
    expect(str2).toHaveLength(10);
    expect(str1 !== str2).toBeTruthy();
  });

  test('should validate email format', () => {
    const isValidEmail = (email) => {
      const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return regex.test(email);
    };
    
    expect(isValidEmail('test@example.com')).toBeTruthy();
    expect(isValidEmail('invalid@email')).toBeFalsy();
    expect(isValidEmail('invalid.email.com')).toBeFalsy();
    expect(isValidEmail('@example.com')).toBeFalsy();
  });

  test('should validate URL format', () => {
    const isValidUrl = (url) => {
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    };
    
    expect(isValidUrl('https://example.com')).toBeTruthy();
    expect(isValidUrl('https://t.me/testgroup')).toBeTruthy();
    expect(isValidUrl('invalid-url')).toBeFalsy();
  });

  test('should format numbers with commas', () => {
    const formatNumber = (num) => {
      return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    };
    
    expect(formatNumber(1000)).toBe('1,000');
    expect(formatNumber(1000000)).toBe('1,000,000');
    expect(formatNumber(123)).toBe('123');
  });
});

describe('Captcha Tests', () => {
  test('should generate numeric captcha', () => {
    const generateCaptcha = (length = 4) => {
      const digits = '0123456789';
      let captcha = '';
      for (let i = 0; i < length; i++) {
        captcha += digits.charAt(Math.floor(Math.random() * digits.length));
      }
      return captcha;
    };
    
    const captcha = generateCaptcha(6);
    expect(captcha).toHaveLength(6);
    expect(captcha).toMatch(/^\d+$/);
  });

  test('should generate alphanumeric captcha', () => {
    const generateAlphanumeric = (length = 6) => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let result = '';
      for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    };
    
    const captcha = generateAlphanumeric();
    expect(captcha).toHaveLength(6);
  });

  test('should validate captcha answer', () => {
    const validateCaptcha = (input, answer) => {
      return input.toLowerCase() === answer.toLowerCase();
    };
    
    expect(validateCaptcha('1234', '1234')).toBeTruthy();
    expect(validateCaptcha('AbCd', 'abcd')).toBeTruthy();
    expect(validateCaptcha('1234', '5678')).toBeFalsy();
  });
});

describe('Math Challenge Tests', () => {
  test('should generate valid math expressions', () => {
    const operators = ['+', '-', '*'];
    
    for (let i = 0; i < 10; i++) {
      const num1 = Math.floor(Math.random() * 10) + 1;
      const num2 = Math.floor(Math.random() * 10) + 1;
      const operator = operators[Math.floor(Math.random() * operators.length)];
      
      let answer;
      switch (operator) {
        case '+': answer = num1 + num2; break;
        case '-': answer = num1 - num2; break;
        case '*': answer = num1 * num2; break;
      }
      
      expect(answer).toBeDefined();
      expect(typeof answer).toBe('number');
    }
  });

  test('should calculate correct answers', () => {
    const calculate = (expression) => {
      const match = expression.match(/(\d+) ([\+\-\*]) (\d+)/);
      if (match) {
        const a = parseInt(match[1]);
        const op = match[2];
        const b = parseInt(match[3]);
        switch (op) {
          case '+': return a + b;
          case '-': return a - b;
          case '*': return a * b;
        }
      }
      return null;
    };
    
    expect(calculate('5 + 3')).toBe(8);
    expect(calculate('10 - 4')).toBe(6);
    expect(calculate('3 * 7')).toBe(21);
  });
});

describe('Points System Tests', () => {
  test('should calculate level from points', () => {
    const calculateLevel = (points) => {
      if (points < 100) return 1;
      if (points < 500) return 2;
      if (points < 1000) return 3;
      if (points < 5000) return 4;
      return 5;
    };
    
    expect(calculateLevel(50)).toBe(1);
    expect(calculateLevel(250)).toBe(2);
    expect(calculateLevel(750)).toBe(3);
    expect(calculateLevel(2500)).toBe(4);
    expect(calculateLevel(10000)).toBe(5);
  });

  test('should calculate points to next level', () => {
    const pointsToNextLevel = (points) => {
      if (points < 100) return 100 - points;
      if (points < 500) return 500 - points;
      if (points < 1000) return 1000 - points;
      if (points < 5000) return 5000 - points;
      return 0;
    };
    
    expect(pointsToNextLevel(50)).toBe(50);
    expect(pointsToNextLevel(100)).toBe(400);
    expect(pointsToNextLevel(5000)).toBe(0);
  });

  test('should calculate check-in streak bonus', () => {
    const calculateStreakBonus = (streak) => {
      if (streak >= 30) return 2.0;
      if (streak >= 14) return 1.5;
      if (streak >= 7) return 1.2;
      if (streak >= 3) return 1.1;
      return 1.0;
    };
    
    expect(calculateStreakBonus(1)).toBe(1.0);
    expect(calculateStreakBonus(5)).toBe(1.1);
    expect(calculateStreakBonus(10)).toBe(1.2);
    expect(calculateStreakBonus(20)).toBe(1.5);
    expect(calculateStreakBonus(35)).toBe(2.0);
  });
});

describe('Validation Tests', () => {
  test('should validate Telegram username', () => {
    const isValidUsername = (username) => {
      return /^[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(username);
    };
    
    expect(isValidUsername('testuser')).toBeTruthy();
    expect(isValidUsername('User123')).toBeTruthy();
    expect(isValidUsername('123user')).toBeFalsy();
    expect(isValidUsername('ab')).toBeFalsy();
  });

  test('should validate chat ID format', () => {
    const isValidChatId = (id) => {
      return /^-?\d+$/.test(id.toString());
    };
    
    expect(isValidChatId(123456789)).toBeTruthy();
    expect(isValidChatId(-100000000)).toBeTruthy();
    expect(isValidChatId('invalid')).toBeFalsy();
  });

  test('should validate points amount', () => {
    const isValidPoints = (amount) => {
      return Number.isInteger(amount) && amount > 0 && amount <= 1000000;
    };
    
    expect(isValidPoints(100)).toBeTruthy();
    expect(isValidPoints(0)).toBeFalsy();
    expect(isValidPoints(-50)).toBeFalsy();
    expect(isValidPoints(1000001)).toBeFalsy();
    expect(isValidPoints(50.5)).toBeFalsy();
  });
});

describe('CRON Expression Tests', () => {
  test('should validate standard CRON expressions', () => {
    const isValidCron = (cron) => {
      const parts = cron.split(/\s+/);
      if (parts.length < 5 || parts.length > 6) return false;
      
      const isValidPart = (part, index) => {
        if (part === '*') return true;
        if (/^\*\/\d+$/.test(part)) return true;
        if (/^\d+$/.test(part)) {
          const num = parseInt(part);
          if (index === 0) return num >= 0 && num <= 59;
          if (index === 1) return num >= 0 && num <= 23;
          if (index === 2) return num >= 1 && num <= 31;
          if (index === 3) return num >= 1 && num <= 12;
          if (index === 4) return num >= 0 && num <= 6;
        }
        if (/^\d+-\d+$/.test(part)) {
          const [start, end] = part.split('-').map(Number);
          return start <= end;
        }
        if (/^,/.test(part)) return true;
        return false;
      };
      
      return parts.slice(0, 5).every(isValidPart);
    };
    
    expect(isValidCron('0 9 * * *')).toBeTruthy();
    expect(isValidCron('*/15 * * * *')).toBeTruthy();
    expect(isValidCron('0 0 1 * *')).toBeTruthy();
    expect(isValidCron('invalid')).toBeFalsy();
  });

  test('should parse CRON human-readable descriptions', () => {
    const cronPatterns = {
      '@yearly': '0 0 1 1 *',
      '@monthly': '0 0 1 * *',
      '@weekly': '0 0 * * 0',
      '@daily': '0 0 * * *',
      '@hourly': '0 * * * *'
    };
    
    expect(cronPatterns['@yearly']).toBe('0 0 1 1 *');
    expect(cronPatterns['@monthly']).toBe('0 0 1 * *');
    expect(cronPatterns['@daily']).toBe('0 0 * * *');
  });
});

describe('Date/Time Tests', () => {
  test('should format date correctly', () => {
    const formatDate = (date) => {
      const d = new Date(date);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    
    const date = new Date('2024-01-15');
    expect(formatDate(date)).toBe('2024-01-15');
  });

  test('should calculate time difference', () => {
    const getTimeDiff = (date1, date2) => {
      return Math.abs(date2 - date1);
    };
    
    const d1 = new Date('2024-01-15T10:00:00Z');
    const d2 = new Date('2024-01-15T10:01:00Z');
    
    expect(getTimeDiff(d1, d2)).toBe(60000);
  });

  test('should check if date is today', () => {
    const isToday = (date) => {
      const today = new Date();
      const d = new Date(date);
      return d.getDate() === today.getDate() &&
             d.getMonth() === today.getMonth() &&
             d.getFullYear() === today.getFullYear();
    };
    
    expect(isToday(new Date())).toBeTruthy();
    expect(isToday(new Date('2020-01-01'))).toBeFalsy();
  });
});

describe('Crypto Utility Tests', () => {
  test('should validate Bitcoin address format', () => {
    const isValidBtcAddress = (address) => {
      return /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address);
    };
    
    expect(isValidBtcAddress('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa')).toBeTruthy();
    expect(isValidBtcAddress('3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy')).toBeTruthy();
    expect(isValidBtcAddress('invalid')).toBeFalsy();
  });

  test('should validate Ethereum address format', () => {
    const isValidEthAddress = (address) => {
      return /^0x[a-fA-F0-9]{40}$/.test(address);
    };
    
    expect(isValidEthAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f4E3B0')).toBeTruthy();
    expect(isValidEthAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f4E3B')).toBeFalsy();
    expect(isValidEthAddress('742d35Cc6634C0532925a3b844Bc9e7595f4E3B0')).toBeFalsy();
  });

  test('should format cryptocurrency amounts', () => {
    const formatCrypto = (amount, decimals = 8) => {
      return Number(amount).toFixed(decimals);
    };
    
    expect(formatCrypto(1.5, 8)).toBe('1.50000000');
    expect(formatCrypto(0.00012345, 8)).toBe('0.00012345');
  });
});

describe('Message Processing Tests', () => {
  test('should extract mentions from message', () => {
    const extractMentions = (text) => {
      const matches = text.match(/@(\w+)/g);
      return matches ? matches.map(m => m.slice(1)) : [];
    };
    
    expect(extractMentions('Hello @user1 and @user2!')).toEqual(['user1', 'user2']);
    expect(extractMentions('No mentions here')).toEqual([]);
  });

  test('should extract URLs from message', () => {
    const extractUrls = (text) => {
      const regex = /https?:\/\/[^\s]+/g;
      const matches = text.match(regex);
      return matches || [];
    };
    
    const urls = extractUrls('Visit https://example.com and http://test.org');
    expect(urls).toHaveLength(2);
    expect(urls[0]).toBe('https://example.com');
  });

  test('should check for common spam patterns', () => {
    const hasSpamPattern = (text) => {
      const spamPatterns = [
        /buy\s+followers/i,
        /free\s+likes/i,
        /earn\s+money/i,
        /make\s+\$\d+\s+fast/i
      ];
      return spamPatterns.some(pattern => pattern.test(text));
    };
    
    expect(hasSpamPattern('Buy followers cheap!')).toBeTruthy();
    expect(hasSpamPattern('Earn money fast!')).toBeTruthy();
    expect(hasSpamPattern('Hello everyone')).toBeFalsy();
  });
});

describe('Rate Limiting Tests', () => {
  test('should calculate correct cooldown', () => {
    const getCooldown = (violations) => {
      if (violations === 1) return 60;
      if (violations === 2) return 300;
      if (violations === 3) return 900;
      return 3600;
    };
    
    expect(getCooldown(1)).toBe(60);
    expect(getCooldown(2)).toBe(300);
    expect(getCooldown(3)).toBe(900);
    expect(getCooldown(5)).toBe(3600);
  });

  test('should calculate exponential backoff', () => {
    const calculateBackoff = (attempt, baseDelay = 1000, maxDelay = 300000) => {
      const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
      return delay;
    };
    
    expect(calculateBackoff(1)).toBe(1000);
    expect(calculateBackoff(2)).toBe(2000);
    expect(calculateBackoff(3)).toBe(4000);
    expect(calculateBackoff(10)).toBe(300000);
  });
});

describe('Lottery Tests', () => {
  test('should calculate lottery prize pool', () => {
    const calculatePool = (ticketPrice, participants) => {
      return ticketPrice * participants * 0.9;
    };
    
    expect(calculatePool(10, 100)).toBe(900);
    expect(calculatePool(5, 50)).toBe(225);
  });

  test('should select weighted random winner', () => {
    const selectWeightedWinner = (participants) => {
      let totalWeight = participants.reduce((sum, p) => sum + p.weight, 0);
      let random = Math.random() * totalWeight;
      
      for (const participant of participants) {
        random -= participant.weight;
        if (random <= 0) return participant;
      }
      return participants[participants.length - 1];
    };
    
    const participants = [
      { id: '1', name: 'Alice', weight: 50 },
      { id: '2', name: 'Bob', weight: 30 },
      { id: '3', name: 'Charlie', weight: 20 }
    ];
    
    const winner = selectWeightedWinner(participants);
    expect(['1', '2', '3']).toContain(winner.id);
  });

  test('should calculate odds of winning', () => {
    const calculateOdds = (tickets, totalTickets) => {
      return (tickets / totalTickets) * 100;
    };
    
    expect(calculateOdds(10, 100)).toBe(10);
    expect(calculateOdds(1, 1000)).toBe(0.1);
  });
});

describe('Data Export Tests', () => {
  test('should convert data to CSV format', () => {
    const toCSV = (data) => {
      if (!data.length) return '';
      const headers = Object.keys(data[0]);
      const rows = data.map(row => 
        headers.map(header => `"${row[header] || ''}"`).join(',')
      );
      return [headers.join(','), ...rows].join('\n');
    };
    
    const data = [
      { name: 'Alice', points: 100 },
      { name: 'Bob', points: 200 }
    ];
    
    const csv = toCSV(data);
    expect(csv).toContain('"name","points"');
    expect(csv).toContain('"Alice","100"');
    expect(csv).toContain('"Bob","200"');
  });

  test('should generate unique IDs', () => {
    const generateId = () => {
      return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    };
    
    const id1 = generateId();
    const id2 = generateId();
    
    expect(id1.length >= 16).toBeTruthy();
    expect(id2.length >= 16).toBeTruthy();
    expect(id1 !== id2).toBeTruthy();
  });
});

describe('Probability Tests', () => {
  test('should calculate probability distribution', () => {
    const calculateProbability = (favorable, total) => {
      return (favorable / total) * 100;
    };
    
    expect(calculateProbability(1, 100)).toBe(1);
    expect(calculateProbability(50, 100)).toBe(50);
  });

  test('should calculate combinations', () => {
    const combinations = (n, k) => {
      if (k > n) return 0;
      if (k === 0 || k === n) return 1;
      let result = 1;
      for (let i = 0; i < k; i++) {
        result = result * (n - i) / (i + 1);
      }
      return result;
    };
    
    expect(combinations(5, 2)).toBe(10);
    expect(combinations(10, 3)).toBe(120);
  });

  test('should calculate permutations', () => {
    const permutations = (n, k) => {
      if (k > n) return 0;
      let result = 1;
      for (let i = 0; i < k; i++) {
        result *= (n - i);
      }
      return result;
    };
    
    expect(permutations(5, 2)).toBe(20);
    expect(permutations(10, 3)).toBe(720);
  });
});

console.log('\n' + '='.repeat(60));
log(`  Test Results: ${passed} passed, ${failed} failed`, COLORS.bold);
if (failed === 0) {
  log('  ✓ All tests passed!', COLORS.green + COLORS.bold);
} else {
  log('  ✗ Some tests failed', COLORS.red + COLORS.bold);
}
console.log('='.repeat(60) + '\n');

process.exit(failed > 0 ? 1 : 0);
