const { spawnSync } = require('child_process');
const path = require('path');

const REPOSITORY_ROOT = path.resolve(__dirname, '..');
const UPSTREAM_REMOTE = 'upstream';
const UPSTREAM_URL = 'https://github.com/usebruno/bruno.git';
const MAIN_BRANCH = 'main';
const ORIGIN_REMOTE = 'origin';

const runGit = (args, { capture = false, allowFailure = false } = {}) => {
  const result = spawnSync('git', args, {
    cwd: REPOSITORY_ROOT,
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit'
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0 && !allowFailure) {
    const details = capture ? result.stderr.trim() : '';
    throw new Error(`git ${args.join(' ')} failed${details ? `: ${details}` : ''}`);
  }

  return result;
};

const readGit = (args) => runGit(args, { capture: true }).stdout.trim();

const assertRepositoryRoot = () => {
  const detectedRoot = path.resolve(readGit(['rev-parse', '--show-toplevel']));

  if (detectedRoot !== REPOSITORY_ROOT) {
    throw new Error(`Expected Git repository root at ${REPOSITORY_ROOT}, but found ${detectedRoot}`);
  }
};

const assertCleanWorkingTree = () => {
  if (readGit(['status', '--porcelain'])) {
    throw new Error('Working tree is not clean. Commit or stash your changes before syncing upstream.');
  }
};

const ensureUpstreamRemote = () => {
  const result = runGit(['remote', 'get-url', UPSTREAM_REMOTE], {
    capture: true,
    allowFailure: true
  });

  if (result.status === 0) {
    console.log(`Using existing ${UPSTREAM_REMOTE} remote: ${result.stdout.trim()}`);
    return;
  }

  console.log(`Adding ${UPSTREAM_REMOTE} remote: ${UPSTREAM_URL}`);
  runGit(['remote', 'add', UPSTREAM_REMOTE, UPSTREAM_URL]);
};

const assertLocalMainExists = () => {
  const result = runGit(['show-ref', '--verify', '--quiet', `refs/heads/${MAIN_BRANCH}`], {
    allowFailure: true
  });

  if (result.status !== 0) {
    throw new Error(`Local ${MAIN_BRANCH} branch does not exist.`);
  }
};

const assertMainCanFastForward = () => {
  const upstreamMain = `${UPSTREAM_REMOTE}/${MAIN_BRANCH}`;
  const result = runGit(['merge-base', '--is-ancestor', MAIN_BRANCH, upstreamMain], {
    allowFailure: true
  });

  if (result.status !== 0) {
    throw new Error(
      `Local ${MAIN_BRANCH} has diverged from ${upstreamMain}. Resolve it manually before running this script again.`
    );
  }
};

const updateLocalMain = () => {
  const currentBranch = runGit(['symbolic-ref', '--quiet', '--short', 'HEAD'], {
    capture: true,
    allowFailure: true
  }).stdout.trim();
  const upstreamMain = `${UPSTREAM_REMOTE}/${MAIN_BRANCH}`;

  if (currentBranch === MAIN_BRANCH) {
    runGit(['merge', '--ff-only', upstreamMain]);
    return;
  }

  runGit(['branch', '--force', MAIN_BRANCH, upstreamMain]);
};

const syncUpstream = () => {
  assertRepositoryRoot();
  assertCleanWorkingTree();
  ensureUpstreamRemote();
  assertLocalMainExists();

  console.log(`Fetching ${UPSTREAM_REMOTE}...`);
  runGit(['fetch', '--prune', UPSTREAM_REMOTE]);

  assertMainCanFastForward();

  console.log(`Fast-forwarding local ${MAIN_BRANCH} to ${UPSTREAM_REMOTE}/${MAIN_BRANCH}...`);
  updateLocalMain();

  console.log(`Pushing ${MAIN_BRANCH} to ${ORIGIN_REMOTE}...`);
  runGit(['push', ORIGIN_REMOTE, `${MAIN_BRANCH}:${MAIN_BRANCH}`]);

  console.log(`${MAIN_BRANCH} is synchronized with ${UPSTREAM_REMOTE}/${MAIN_BRANCH} locally and on ${ORIGIN_REMOTE}.`);
};

try {
  syncUpstream();
} catch (error) {
  console.error(`Upstream sync failed: ${error.message}`);
  process.exit(1);
}
