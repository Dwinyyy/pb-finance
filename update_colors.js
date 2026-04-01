import * as fs from 'fs';

const pages = [
  'src/pages/PublicPages.jsx',
  'src/pages/ClientPages.jsx',
  'src/pages/ProfessionalPages.jsx',
  'src/App.jsx'
];

pages.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/indigo-/g, 'primary-');
    fs.writeFileSync(file, content);
  }
});
console.log('Colors updated successfully to primary palette!');
