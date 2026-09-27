#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContent, helpText, parseArguments } from '../src/scaffold.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

try {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(helpText);
  } else {
    const result = createContent({ root, ...options });
    console.log(result.dryRun ? `预览计划：新增 ${result.id}，未写入文件。` : `已新增 ${result.id}。`);
    console.log(result.dryRun ? '将更新以下文件：' : '请编辑以下文件：');
    for (const file of result.files) {
      console.log(`  ${file}`);
    }
    if (result.memberId) {
      console.log(`成员 ${result.memberId} 的个人主页${result.dryRun ? '将' : '已'}关联至 ${result.profilePath}。`);
    }
    console.log('请填写所有 TODO、中英文内容、图片路径及论文年份，再运行 npm run build 和 npm run check。');
    console.log('未完成的 TODO 会阻止构建发布。');
  }
} catch (error) {
  console.error(`错误：${error.message}`);
  process.exitCode = 1;
}
