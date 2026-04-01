import * as fs from 'fs';

let content = fs.readFileSync('src/pages/ClientPages.jsx', 'utf8');

// 1. Add matchmaker state to ClientPortal
content = content.replace(
  `export function ClientPortal({ user, onLogout }) {\n  const [appView, setAppView] = useState('discover');`, 
  `export function ClientPortal({ user, onLogout }) {\n  const [appView, setAppView] = useState('discover');\n  const [matchmakerVisible, setMatchmakerVisible] = useState(true);`
);

// 2. Add AI button to header
content = content.replace(
  `<button className="text-slate-400 hover:text-white relative transition-colors">\n                <Bell size={20} />\n                <span className="absolute top-0 right-0 w-2 h-2 bg-primary-500 rounded-full"></span>\n              </button>`,
  `<button onClick={() => setMatchmakerVisible(!matchmakerVisible)} className={\`relative transition-colors \${matchmakerVisible ? 'text-primary-400' : 'text-slate-400 hover:text-white'}\`} title="Toggle AI Matchmaker">\n                <Bot size={20} />\n              </button>\n              <button className="text-slate-400 hover:text-white relative transition-colors">\n                <Bell size={20} />\n                <span className="absolute top-0 right-0 w-2 h-2 bg-primary-500 rounded-full"></span>\n              </button>`
);

// 3. Pass prop to Matchmaker
content = content.replace(
  `<AITalentMatchmaker />`,
  `{matchmakerVisible && <AITalentMatchmaker />}`
);

// 4. Make Matchmaker Draggable by replacing div with motion.div
content = content.replace(`import FadeIn from '../components/FadeIn';`, `import FadeIn from '../components/FadeIn';\nimport { motion } from 'framer-motion';`);

content = content.replace(
  `<div className={\`fixed bottom-8 right-8 w-[400px] h-[600px] max-h-[80vh] bg-white rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] border border-slate-200 flex flex-col z-50 transition-all duration-300 origin-bottom-right \${isOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'}\`}>`,
  `<motion.div drag dragMomentum={false} className={\`fixed bottom-8 right-8 w-[400px] h-[600px] max-h-[80vh] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col z-50 transition-all duration-300 origin-bottom-right \${isOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'}\`}>`
);

content = content.replace(
  `{/* Chat Input */}`,
  `{/* Chat Input */}\n        </motion.div>\n        {/* original div replacement */}`
);
content = content.replace(`</motion.div>\n        {/* original div replacement */}\n        <div className="p-4 bg-white border-t border-slate-200 shrink-0">`, `        <div className="p-4 bg-white border-t border-slate-200 shrink-0">`);
// Need to find and replace the closing </div> of Chat Window. 
// Instead of messing with closing tags via regex strings, I'll use a specific replace.
content = content.replace(/<\/div>\n    <\/([^>]+)>/, '</motion.div>\n    </$1>');


// 5. Update data filtering
content = content.replace(
  `const [activeFilter, setActiveFilter] = useState('All');`,
  `const [activeFilter, setActiveFilter] = useState('All');\n  \n  const filteredProfiles = useMemo(() => {\n    if (activeFilter === 'All') return TALENT_PROFILES;\n    return TALENT_PROFILES.filter(p => \n      p.role.includes(activeFilter) || \n      p.tools.some(t => t.includes(activeFilter))\n    );\n  }, [activeFilter]);`
);

content = content.replace(
  `Showing {TALENT_PROFILES.length} profiles`,
  `Showing {filteredProfiles.length} profiles`
);

content = content.replace(
  `{TALENT_PROFILES.map((profile, idx) => (`,
  `{filteredProfiles.map((profile, idx) => (`
);

fs.writeFileSync('src/pages/ClientPages.jsx', content);

// Update Public Pages for filtering
let publicContent = fs.readFileSync('src/pages/PublicPages.jsx', 'utf8');
publicContent = publicContent.replace(`import FadeIn from '../components/FadeIn';`, `import FadeIn from '../components/FadeIn';\nimport { motion } from 'framer-motion';`);

publicContent = publicContent.replace(
  `const [activeFilter, setActiveFilter] = useState('All');`,
  `const [activeFilter, setActiveFilter] = useState('All');\n  \n  const filteredProfiles = useMemo(() => {\n    if (activeFilter === 'All') return TALENT_PROFILES;\n    return TALENT_PROFILES.filter(p => \n      p.role.includes(activeFilter) || \n      p.tools.some(t => t.includes(activeFilter))\n    );\n  }, [activeFilter]);`
);
publicContent = publicContent.replace(`{TALENT_PROFILES.slice(0, 6).map((profile, idx) => (`, `{filteredProfiles.slice(0, 6).map((profile, idx) => (`);

fs.writeFileSync('src/pages/PublicPages.jsx', publicContent);

console.log('Features added!');
