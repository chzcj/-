#!/usr/bin/env node
/**
 * 开工前同步 Gitee 远程状态，供 Cursor / Trae / Codex 共用。
 * 用法: node .agents/scripts/sync-gitee.mjs
 *       npm run sync:gitee
 *
 * 可选: 在 .env.local 设置 GITEE_PRIVATE_TOKEN（勿提交 Git）
 */
import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const HANDOFF_PATH = path.join(ROOT, '.agents/HANDOFF.md');
const REMOTE_BRANCH = process.env.GITEE_BRANCH || 'master';
const REMOTE = `origin/${REMOTE_BRANCH}`;
const GITEE_OWNER = 'heartlab';
const GITEE_REPO = 'yujian';

function run(cmd, options = {}) {
  return execSync(cmd, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  }).trim();
}

function tryRun(cmd) {
  try {
    return { ok: true, out: run(cmd) };
  } catch (error) {
    const stderr = error.stderr?.toString?.() || error.message || '';
    return { ok: false, err: stderr.trim() };
  }
}

function loadEnvLocal() {
  const envPath = path.join(ROOT, '.env.local');
  if (!fs.existsSync(envPath)) return {};
  const vars = {};
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    vars[key] = value;
  }
  return vars;
}

function getToken() {
  return process.env.GITEE_PRIVATE_TOKEN || loadEnvLocal().GITEE_PRIVATE_TOKEN || '';
}

function gitFetch() {
  const token = getToken();
  const env = { ...process.env };
  if (token) {
    env.GIT_TERMINAL_PROMPT = '0';
    env.GIT_CONFIG_COUNT = '1';
    env.GIT_CONFIG_KEY_0 = `url.https://oauth2:${token}@gitee.com/.insteadOf`;
    env.GIT_CONFIG_VALUE_0 = 'https://gitee.com/';
  }
  const result = spawnSync('git', ['fetch', 'origin', REMOTE_BRANCH], {
    cwd: ROOT,
    encoding: 'utf8',
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status === 0) return { ok: true, via: token ? 'token' : 'credential' };
  return {
    ok: false,
    err: (result.stderr || result.stdout || 'git fetch failed').trim(),
  };
}

async function fetchCommitsViaApi(limit = 8) {
  const token = getToken();
  if (!token) return null;
  const url = `https://gitee.com/api/v5/repos/${GITEE_OWNER}/${GITEE_REPO}/commits?sha=${REMOTE_BRANCH}&per_page=${limit}&access_token=${encodeURIComponent(token)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return { error: `API ${res.status}` };
    const data = await res.json();
    if (!Array.isArray(data)) return { error: 'unexpected API response' };
    return data.map((c) => ({
      hash: (c.sha || '').slice(0, 7),
      author: c.commit?.author?.name || c.author?.name || '?',
      date: (c.commit?.author?.date || '').slice(0, 16).replace('T', ' '),
      message: (c.commit?.message || '').split('\n')[0],
    }));
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

function section(title) {
  console.log(`\n## ${title}`);
}

function readHandoffTail(lines = 40) {
  if (!fs.existsSync(HANDOFF_PATH)) {
    return '（尚无 HANDOFF.md，收工后请按 .agents/README.md 追加记录）';
  }
  const content = fs.readFileSync(HANDOFF_PATH, 'utf8');
  const blocks = content.split(/\n(?=## \d{4}-\d{2}-\d{2})/);
  const last = blocks.filter((b) => b.trim()).at(-1) || content;
  const tail = last.trim().split('\n').slice(0, lines).join('\n');
  return tail;
}

function main() {
  console.log('# Gitee 协作同步报告');
  console.log(`仓库: https://gitee.com/${GITEE_OWNER}/${GITEE_REPO}`);
  console.log(`分支: ${REMOTE_BRANCH}`);
  console.log(`时间: ${new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC`);
  console.log(`路径: ${ROOT}`);

  const fetchResult = gitFetch();
  section('远程同步');
  if (fetchResult.ok) {
    console.log(`git fetch origin ${REMOTE_BRANCH} — 成功 (${fetchResult.via})`);
  } else {
    console.log(`git fetch — 失败: ${fetchResult.err}`);
    console.log('提示: 在 .env.local 设置 GITEE_PRIVATE_TOKEN 后重试，或先配置 git 凭据。');
  }

  const localBranch = tryRun('git rev-parse --abbrev-ref HEAD');
  section('本地分支');
  console.log(localBranch.ok ? localBranch.out : '未知');

  if (fetchResult.ok) {
    const counts = tryRun(`git rev-list --left-right --count HEAD...${REMOTE}`);
    section('与远程差距 (左=本地独有提交, 右=远程独有提交)');
    if (counts.ok) {
      const [ahead, behind] = counts.out.split(/\s+/).map(Number);
      if (behind > 0) console.log(`⚠ 远程有 ${behind} 个新提交 — 建议 git pull origin ${REMOTE_BRANCH}`);
      if (ahead > 0) console.log(`↑ 本地有 ${ahead} 个未推送提交 — 收工后 git push origin ${REMOTE_BRANCH}`);
      if (ahead === 0 && behind === 0) console.log('✓ 与 origin/master 同步');
    }

    section(`远程最近提交 (${REMOTE})`);
    const logFmt = "--format='%h %cs %an %s'";
    const remoteLog = tryRun(`git log ${REMOTE} -8 ${logFmt}`);
    console.log(remoteLog.ok ? remoteLog.out : remoteLog.err);

    if (counts?.ok) {
      const behind = Number(counts.out.split(/\s+/)[1] || 0);
      if (behind > 0) {
        section('你尚未拉取的远程提交');
        const incoming = tryRun(`git log HEAD..${REMOTE} ${logFmt}`);
        console.log(incoming.ok ? incoming.out : incoming.err);
      }
    }

    section('相对远程的工作区变更 (含未提交)');
    const shortStat = tryRun(`git diff --shortstat ${REMOTE}`);
    if (shortStat.ok && shortStat.out) console.log(`已跟踪文件 diff: ${shortStat.out}`);
    const untracked = tryRun('git ls-files --others --exclude-standard | wc -l');
    if (untracked.ok) console.log(`未跟踪文件/目录数: ${untracked.out.trim()}`);
  }

  section('最近 HANDOFF（其他 Agent 留言）');
  console.log(readHandoffTail());

  if (!fetchResult.ok) {
    section('Gitee API 回退（最近提交）');
    fetchCommitsViaApi().then((apiCommits) => {
      if (!apiCommits) {
        console.log('未配置 GITEE_PRIVATE_TOKEN，跳过 API。');
      } else if (apiCommits.error) {
        console.log(`API 失败: ${apiCommits.error}`);
      } else {
        for (const c of apiCommits) {
          console.log(`${c.hash} ${c.date} ${c.author} ${c.message}`);
        }
      }
      printFooter();
    });
    return;
  }

  printFooter();
}

function printFooter() {
  section('开工 Checklist');
  console.log('1. 读完上方 HANDOFF 与远程提交');
  console.log('2. 若远程有新提交: git pull origin master');
  console.log('3. 动手前确认 specs/ 或任务归属，避免与他人改同一文件');
  console.log('4. 收工后更新 .agents/HANDOFF.md 并 push 到 Gitee');
}

main();
