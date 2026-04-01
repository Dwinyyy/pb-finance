import fs from 'fs';

function replaceInFile(file, replacements) {
  let content = fs.readFileSync(file, 'utf8');
  replacements.forEach(([find, replace]) => {
    // Escape string for regex if string, but if regex passed do directly
    if (typeof find === 'string') {
      content = content.replace(new RegExp(find.replace(/[.*+?^$\/{}()|[\\]\\\\]/g, '\\\\$&'), 'g'), replace);
    } else {
      content = content.replace(find, replace);
    }
  });
  fs.writeFileSync(file, content);
}

replaceInFile('src/pages/PublicPages.jsx', [
  ['bg-emerald-50', 'bg-emerald-50 dark:bg-emerald-900/20'],
  ['text-emerald-800', 'text-emerald-800 dark:text-emerald-400'],
  ['text-emerald-700', 'text-emerald-700 dark:text-emerald-400'],
  ['text-primary-800', 'text-primary-800 dark:text-primary-300'],
  ['hover:bg-cyan-50', 'hover:bg-cyan-50 dark:hover:bg-cyan-900/30'],
  ['hover:bg-primary-50 ', 'hover:bg-primary-50 dark:hover:bg-primary-900/30 '],
  ['hover:bg-primary-50"', 'hover:bg-primary-50 dark:hover:bg-primary-900/30"']
]);

replaceInFile('src/pages/ProfessionalPages.jsx', [
  ["border-cyan-600 text-cyan-700", "border-cyan-600 text-cyan-700 dark:border-cyan-400 dark:text-cyan-400"],
  ['text-emerald-800', 'text-emerald-800 dark:text-emerald-400'],
  ['bg-primary-50 text-primary-700', 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400']
]);

replaceInFile('src/pages/ClientPages.jsx', [
  ["border-primary-600 text-primary-700", "border-primary-600 text-primary-700 dark:border-primary-400 dark:text-primary-400"],
  ['bg-emerald-50 text-emerald-600', 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'],
  ['text-primary-600 bg-primary-50', 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30'],
  ['bg-emerald-50 text-emerald-700', 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'],
  ['text-slate-500 uppercase tracking-wide"', 'text-slate-500 dark:text-slate-400 uppercase tracking-wide"']
]);

console.log('Contrast Sweep Complete!');
