import * as fs from 'fs';

const file = 'src/App.jsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /\/\/ --- MOCK DATA ---[\s\S]*?\/\/ --- MAIN APP COMPONENT ---/m;

const replacement = `import { REVIEWS, TALENT_PROFILES, AGENCIES, SERVICE_CARDS, PROCESS_STEPS, FAQ_DATA } from './data/mockData';
import FadeIn from './components/FadeIn';

// --- MAIN APP COMPONENT ---`;

content = content.replace(regex, replacement);

fs.writeFileSync(file, content);
console.log('App.jsx modified successfully!');
