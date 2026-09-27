import { buildSite } from '../src/build-site.mjs';

try {
  const counts = buildSite();
  console.log(`Built English and Chinese editions of ${counts.pages} pages, ${counts.news} news items, ${counts.people} people, ${counts.publications} publications and ${counts.projects} projects.`);
  console.log('Ready in dist/ and repository root (GitHub Pages main /).');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
