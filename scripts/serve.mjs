import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startPreviewServer } from '../src/preview-server.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

try {
  const preview = await startPreviewServer({ root, port: Number(process.env.PORT || 4173) });
  console.log(`本地预览：${preview.url}`);
  console.log('保存 content、src、public 或 site.config.json 后会自动更新。按 Ctrl+C 退出。');
  const stop = async () => {
    await preview.close();
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
} catch (error) {
  console.error(`无法启动本地预览：${error.message}`);
  process.exitCode = 1;
}
