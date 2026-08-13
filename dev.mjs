import { spawn } from 'node:child_process';

const isWin = process.platform === 'win32';

function run(name, command, args) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: isWin,
    env: { ...process.env },
  });
  child.on('exit', (code) => {
    console.log(`\n[dev] ${name} exited with code ${code ?? 0}`);
    killAll(code ?? 0);
  });
  child.on('error', (err) => {
    console.error(`\n[dev] Failed to start ${name}:`, err.message);
    killAll(1);
  });
  return child;
}

const children = [];

function killAll(code) {
  for (const child of children) {
    try {
      child.kill();
    } catch {
      /* ignore */
    }
  }
  if (children.some((c) => !c.killed)) {
    setTimeout(() => process.exit(code), 500);
  } else {
    process.exit(code);
  }
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => killAll(0));
}

console.log('[dev] Starting Vite (web app) and MeetFlow backend together…\n');

children.push(run('vite', 'npx', ['vite']));
children.push(run('server', 'node', ['--env-file=.env', 'server/index.js']));