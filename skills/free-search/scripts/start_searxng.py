#!/usr/bin/env python3
import os
import subprocess
import sys
from pathlib import Path

SKILL_ROOT = Path(__file__).resolve().parents[1]
VENV = SKILL_ROOT / '.venv-searxng'
SETTINGS = SKILL_ROOT / 'scripts' / 'searxng.settings.yml'
PACKAGE_JSON = SKILL_ROOT / 'package.json'
TEST_MODE = os.environ.get('FREE_SEARCH_TEST_MODE') == '1'
SEARXNG_INSTALL_TARGET = 'git+https://github.com/searxng/searxng.git'


def run_command(command: list[str]) -> None:
    if TEST_MODE:
        print(f'[test-mode] {" ".join(command)}')
        return

    subprocess.run(command, check=True)


def install_node_dependencies() -> None:
    if not PACKAGE_JSON.exists():
        return

    print(f'Installing Node.js dependencies from {PACKAGE_JSON}')
    run_command(['npm', 'install', '--prefix', str(SKILL_ROOT)])


def print_install_command() -> None:
    print(
        f'npm install --prefix "{SKILL_ROOT}" && '
        f'python3 -m venv "{VENV}" && '
        f'source "{VENV}/bin/activate" && '
        f'pip install --no-build-isolation {SEARXNG_INSTALL_TARGET}'
    )


def print_start_command() -> None:
    print(
        f'SEARXNG_SETTINGS_PATH="{SETTINGS}" source "{VENV}/bin/activate" && '
        f'SEARXNG_SETTINGS_PATH="{SETTINGS}" python -m searx.webapp'
    )


def print_dry_run() -> None:
    if PACKAGE_JSON.exists():
        print('Plan: install Node.js dependencies')
        print(f'package.json path: {PACKAGE_JSON}')
    print('Plan: create or reuse virtual environment')
    print(f'Virtualenv path: {VENV}')
    print('Plan: install SearXNG dependencies')
    print('Plan: create or reuse local settings file')
    print(f'Settings path: {SETTINGS}')
    print('Plan: start local SearXNG on 127.0.0.1:12783')


def prepare_environment() -> None:
    install_node_dependencies()
    print(f'Creating or reusing virtualenv at {VENV}')
    run_command(['python3', '-m', 'venv', str(VENV)])

    pip_path = VENV / 'bin' / 'pip'
    print('Installing bootstrap dependency: msgspec')
    run_command([str(pip_path), 'install', 'msgspec'])

    print('Installing build tools: setuptools, wheel')
    run_command([str(pip_path), 'install', 'setuptools', 'wheel'])

    print('Installing bootstrap dependencies: PyYAML, typing_extensions')
    run_command([str(pip_path), 'install', 'PyYAML', 'typing_extensions'])

    print('Installing or verifying searxng in the local virtualenv')
    run_command([str(pip_path), 'install', '--no-build-isolation', SEARXNG_INSTALL_TARGET])
    print('Prepare complete')


def start_searxng() -> None:
    python_path = VENV / 'bin' / 'python'
    print(f'Starting local SearXNG with config {SETTINGS}')

    if TEST_MODE:
        print(f'[test-mode] SEARXNG_SETTINGS_PATH={SETTINGS}')
        print(f'[test-mode] {python_path} -m searx.webapp')
        return

    env = os.environ.copy()
    env['SEARXNG_SETTINGS_PATH'] = str(SETTINGS)
    subprocess.run([str(python_path), '-m', 'searx.webapp'], check=True, env=env)


def main() -> int:
    if '--print-install-command' in sys.argv:
        print_install_command()
        return 0

    if '--print-start-command' in sys.argv:
        print_start_command()
        return 0

    if '--dry-run' in sys.argv:
        print_dry_run()
        return 0

    if '--prepare-only' in sys.argv:
        prepare_environment()
        return 0

    prepare_environment()
    start_searxng()
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
