import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const START_SCRIPT = new URL('../skills/free-search/scripts/start_searxng.py', import.meta.url).pathname;
const SETTINGS_FILE = new URL('../skills/free-search/scripts/searxng.settings.yml', import.meta.url).pathname;

test('start_searxng.py prints planned setup steps in dry-run mode', () => {
  const result = spawnSync('python3', [
    START_SCRIPT,
    '--dry-run',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /create or reuse virtual environment/i);
  assert.match(result.stdout, /install searxng dependencies/i);
  assert.match(result.stdout, /start local SearXNG on 127.0.0.1:12783/i);
});

test('start_searxng.py prints a clear dependency install command', () => {
  const result = spawnSync('python3', [
    START_SCRIPT,
    '--print-install-command',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /python3 -m venv/);
  assert.match(result.stdout, /pip install --no-build-isolation git\+https:\/\/github\.com\/searxng\/searxng\.git/);
});

test('start_searxng.py prints a runnable start command that exports SEARXNG_SETTINGS_PATH', () => {
  const result = spawnSync('python3', [
    START_SCRIPT,
    '--print-start-command',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /SEARXNG_SETTINGS_PATH=/);
  assert.match(result.stdout, /python -m searx\.webapp/);
  assert.match(result.stdout, /searxng.settings.yml/);
});

test('start_searxng.py supports prepare-only mode for one-command setup', () => {
  const result = spawnSync('python3', [
    START_SCRIPT,
    '--prepare-only',
  ], {
    encoding: 'utf8',
    env: {
      ...process.env,
      FREE_SEARCH_TEST_MODE: '1',
    },
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /creating or reusing virtualenv/i);
  assert.match(result.stdout, /installing or verifying searxng/i);
  assert.match(result.stdout, /installing bootstrap dependency: msgspec/i);
  assert.match(result.stdout, /installing build tools: setuptools, wheel/i);
  assert.match(result.stdout, /installing bootstrap dependencies: pyyaml, typing_extensions/i);
  assert.match(result.stdout, /prepare complete/i);
});

test('start_searxng.py default mode prepares and starts local searxng', () => {
  const result = spawnSync('python3', [
    START_SCRIPT,
  ], {
    encoding: 'utf8',
    env: {
      ...process.env,
      FREE_SEARCH_TEST_MODE: '1',
    },
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /creating or reusing virtualenv/i);
  assert.match(result.stdout, /installing or verifying searxng/i);
  assert.match(result.stdout, /starting local searxng/i);
  assert.match(result.stdout, /python -m searx\.webapp/);
});

test('local searxng settings define a non-default secret key', () => {
  const settings = readFileSync(SETTINGS_FILE, 'utf8');

  assert.match(settings, /secret_key:/);
  assert.doesNotMatch(settings, /ultrasecretkey/i);
});

test('local searxng settings enable json output', () => {
  const settings = readFileSync(SETTINGS_FILE, 'utf8');

  assert.match(settings, /formats:/i);
  assert.match(settings, /- json/i);
});

test('local searxng settings use a conservative domestic-first allowlist for local validation', () => {
  const settings = readFileSync(SETTINGS_FILE, 'utf8');

  assert.match(settings, /engines:/i);
  assert.match(settings, /name:\s+baidu[\s\S]*disabled:\s+false/i);
  assert.match(settings, /name:\s+bing[\s\S]*disabled:\s+false/i);
  assert.match(settings, /name:\s+zhihu[\s\S]*disabled:\s+false/i);
  assert.match(settings, /name:\s+csdn[\s\S]*disabled:\s+false/i);
  assert.match(settings, /name:\s+bilibili[\s\S]*disabled:\s+false/i);
  assert.doesNotMatch(settings, /name:\s+duckduckgo/i);
  assert.doesNotMatch(settings, /name:\s+brave/i);
  assert.doesNotMatch(settings, /name:\s+google/i);
});
