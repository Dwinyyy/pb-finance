import fs from 'fs';

const pages = [
  'src/pages/PublicPages.jsx',
  'src/pages/ClientPages.jsx',
  'src/pages/ProfessionalPages.jsx',
  'src/App.jsx'
];

const map = {
  'bg-white': 'dark:bg-slate-900',
  'bg-slate-50': 'dark:bg-slate-950',
  'bg-slate-100': 'dark:bg-slate-800',
  'text-slate-950': 'dark:text-white',
  'text-slate-900': 'dark:text-slate-50',
  'text-slate-800': 'dark:text-slate-200',
  'text-slate-700': 'dark:text-slate-300',
  'text-slate-600': 'dark:text-slate-400',
  'border-slate-200': 'dark:border-slate-800',
  'border-slate-100': 'dark:border-slate-800'
};

pages.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    for (const [light, dark] of Object.entries(map)) {
      const regex = new RegExp(`\\b${light}\\b(?!\\s*${dark.replace(/:/g, '\\:')})`, 'g');
      content = content.replace(regex, `${light} ${dark}`);
    }
    fs.writeFileSync(file, content);
  }
});
console.log('Dark mode classes distributed safely into all JSX views.');
