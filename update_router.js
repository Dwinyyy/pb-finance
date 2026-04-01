import * as fs from 'fs';

// 1. Update main.jsx
let mainContent = fs.readFileSync('src/main.jsx', 'utf8');
mainContent = mainContent.replace("import App from './App.jsx'", "import App from './App.jsx'\nimport { BrowserRouter } from 'react-router-dom'");
mainContent = mainContent.replace("<App />", "<BrowserRouter><App /></BrowserRouter>");
fs.writeFileSync('src/main.jsx', mainContent);

// 2. Update PublicPages.jsx
let publicContent = fs.readFileSync('src/pages/PublicPages.jsx', 'utf8');
publicContent = publicContent.replace(`import { REVIEWS`, `import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';\nimport { REVIEWS`);

const publicSiteOriginal = `export function PublicSite({ openAuth }) {
  const [activeTab, setActiveTab] = useState('home');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigateTo = (tab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };`;

const publicSiteNew = `export function PublicSite({ openAuth }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const getActiveTab = () => {
    if (location.pathname === '/talents') return 'talents';
    if (location.pathname === '/agency') return 'agency';
    return 'home';
  };
  const activeTab = getActiveTab();

  const navigateTo = (tab) => {
    const path = tab === 'home' ? '/' : \`/\${tab}\`;
    navigate(path);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };`;

publicContent = publicContent.replace(publicSiteOriginal, publicSiteNew);

const mainOriginal = `<main className="min-h-screen">
        {activeTab === 'home' && <HomeMarketingView navigateTo={navigateTo} openAuth={openAuth} />}
        {activeTab === 'talents' && <PreviewDirectoryView openAuth={openAuth} />}
        {activeTab === 'agency' && <AgencyMarketingView openAuth={openAuth} />}
      </main>`;

const mainNew = `<main className="min-h-screen">
        <Routes>
          <Route path="/" element={<HomeMarketingView navigateTo={navigateTo} openAuth={openAuth} />} />
          <Route path="/talents" element={<PreviewDirectoryView openAuth={openAuth} />} />
          <Route path="/agency" element={<AgencyMarketingView openAuth={openAuth} />} />
        </Routes>
      </main>`;

publicContent = publicContent.replace(mainOriginal, mainNew);

fs.writeFileSync('src/pages/PublicPages.jsx', publicContent);
console.log('Routing integrated successfully');
