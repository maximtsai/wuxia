import { readFile, writeFile } from 'node:fs/promises';
import type { IncomingMessage } from 'node:http';
import { fileURLToPath } from 'node:url';
import { format, resolveConfig } from 'prettier';
import { defineConfig, type Plugin } from 'vite';
import { validateSkillData, validateTreeData } from './src/content/schema.ts';

const dataFile = (name: 'skills' | 'tree') =>
  fileURLToPath(new URL(`./src/content/data/${name}.json`, import.meta.url));

function readBody(req: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk: string) => {
      body += chunk;
      if (body.length > 5_000_000) reject(new Error('Request too large'));
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

/** Writes Prettier-formatted JSON, skipping unchanged files so HMR only fires for real edits. */
async function writeJson(name: 'skills' | 'tree', data: unknown) {
  const file = dataFile(name);
  const text = await format(JSON.stringify(data), {
    ...(await resolveConfig(file)),
    parser: 'json',
  });
  if ((await readFile(file, 'utf8')) !== text) await writeFile(file, text);
}

/** Dev-server-only endpoint that lets editor.html save validated content to src/content/data. */
function contentEditor(): Plugin {
  return {
    name: 'content-editor',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__editor/save', (req, res) => {
        const reply = (status: number, body: object) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(body));
        };
        // Requiring a JSON content type forces a CORS preflight for cross-site requests.
        if (
          req.method !== 'POST' ||
          !req.headers['content-type']?.startsWith('application/json')
        )
          return reply(405, { issues: ['POST JSON only'] });
        void (async () => {
          try {
            const { skills, tree } = JSON.parse(await readBody(req)) as {
              skills: unknown;
              tree: unknown;
            };
            const current = JSON.parse(
              await readFile(dataFile('skills'), 'utf8'),
            ) as object;
            const skillIssues = validateSkillData(skills, {
              expectedIds: Object.keys(current),
            });
            const issues = [
              ...skillIssues,
              ...(skillIssues.length
                ? []
                : validateTreeData(tree, {
                    skillIds: Object.keys(skills as object),
                  })),
            ];
            if (issues.length)
              return reply(422, { issues: issues.map((i) => i.message) });
            await writeJson('skills', skills);
            await writeJson('tree', tree);
            reply(200, { ok: true });
          } catch (error) {
            reply(400, {
              issues: [error instanceof Error ? error.message : String(error)],
            });
          }
        })();
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [contentEditor()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
