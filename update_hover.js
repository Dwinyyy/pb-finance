import fs from 'fs';

const pages = [
  'src/pages/PublicPages.jsx',
  'src/pages/ClientPages.jsx'
];

pages.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/<FadeIn key={([^}]+)} delay={([^}]+)} direction="up" className=/g, '<FadeIn key={$1} delay={$2} direction="up" hover={true} className=');
  content = content.replace(/<FadeIn delay={([^}]+)} className=/g, '<FadeIn delay={$1} hover={true} className=');
  fs.writeFileSync(file, content);
});
console.log('Hover added to main cards!');
