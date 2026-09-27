import { loadContent } from '../src/content.mjs';

try {
  loadContent();
  console.log('内容检查通过：字段、双语、分组、页面地址、图片和成员关联均有效。');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
