import fs from 'fs';

let content = fs.readFileSync('src/pages/PublicPages.jsx', 'utf8');

content = content.replace(
  `{['home', 'talents', 'agency'].map((tab) => (`,
  `{['home', 'talents', 'agency', 'pricing'].map((tab) => (`
);

content = content.replace(
  `{tab === 'home' ? 'Overview' : tab === 'talents' ? 'Directory' : 'Enterprise'}`,
  `{tab === 'home' ? 'Overview' : tab === 'talents' ? 'Directory' : tab === 'pricing' ? 'Pricing' : 'Enterprise'}`
);

content = content.replace(
  `if (location.pathname === '/agency') return 'agency';`,
  `if (location.pathname === '/agency') return 'agency';\n    if (location.pathname === '/pricing') return 'pricing';`
);

content = content.replace(
  `<Route path="/agency" element={<AgencyMarketingView openAuth={openAuth} />} />`,
  `<Route path="/agency" element={<AgencyMarketingView openAuth={openAuth} />} />\n          <Route path="/pricing" element={<PricingView openAuth={openAuth} />} />`
);

const pricingComponent = `
function PricingView({ openAuth }) {
  return (
    <div className="animate-in fade-in duration-700 bg-white dark:bg-slate-900 pt-32 pb-40 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeIn hover={true}>
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h1 className="text-5xl font-bold tracking-tight text-slate-950 dark:text-white mb-6">Transparent Platform Fees</h1>
            <p className="text-xl text-slate-600 dark:text-slate-400">Simple, predictable models to augment your finance team.</p>
          </div>
        </FadeIn>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          <FadeIn delay={100} direction="up" hover={true} className="h-full">
            <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-[32px] p-10 flex flex-col h-full hover:shadow-xl transition-shadow">
              <h3 className="text-2xl font-bold text-slate-950 dark:text-white mb-2">Platform Access</h3>
              <p className="text-slate-500 dark:text-slate-400 mb-8">Best for hiring 1-2 remote professionals.</p>
              <div className="text-5xl font-black text-slate-950 dark:text-white tracking-tight mb-8">Free<span className="text-lg font-bold text-slate-500 tracking-normal"> forever</span></div>
              <ul className="space-y-4 mb-10 flex-grow">
                <li className="flex items-center text-slate-700 dark:text-slate-300"><CheckCircle className="text-primary-500 w-5 h-5 mr-3"/> Browse full talent directory</li>
                <li className="flex items-center text-slate-700 dark:text-slate-300"><CheckCircle className="text-primary-500 w-5 h-5 mr-3"/> Interview up to 3 candidates</li>
                <li className="flex items-center text-slate-700 dark:text-slate-300"><CheckCircle className="text-primary-500 w-5 h-5 mr-3"/> Standard KYC compliance</li>
              </ul>
              <button onClick={() => openAuth('register')} className="w-full bg-slate-950 text-white rounded-full py-4 font-bold hover:bg-primary-600 transition-colors">Create Free Account</button>
            </div>
          </FadeIn>

          <FadeIn delay={200} direction="up" hover={true} className="h-full">
            <div className="bg-slate-950 border border-slate-800 rounded-[32px] p-10 flex flex-col h-full shadow-2xl relative overflow-hidden group hover:border-primary-500 transition-colors">
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary-600/20 blur-[60px] rounded-full pointer-events-none group-hover:bg-cyan-500/20 transition-colors"></div>
              <h3 className="text-2xl font-bold text-white mb-2 relative z-10">Enterprise Pods</h3>
              <p className="text-slate-400 mb-8 relative z-10">Dedicated managed teams and SLAs.</p>
              <div className="text-5xl font-black text-white tracking-tight mb-8 relative z-10">Custom</div>
              <ul className="space-y-4 mb-10 flex-grow relative z-10">
                <li className="flex items-center text-slate-300"><CheckCircle className="text-cyan-400 w-5 h-5 mr-3"/> Dedicated US-based Account Manager</li>
                <li className="flex items-center text-slate-300"><CheckCircle className="text-cyan-400 w-5 h-5 mr-3"/> Custom SOC2 secure enclaves</li>
                <li className="flex items-center text-slate-300"><CheckCircle className="text-cyan-400 w-5 h-5 mr-3"/> Priority placement within 72hrs</li>
              </ul>
              <button onClick={() => openAuth('register')} className="w-full bg-white text-slate-950 dark:text-white dark:bg-slate-800 dark:hover:bg-slate-700 rounded-full py-4 font-bold hover:bg-slate-50 transition-colors relative z-10">Contact Sales</button>
            </div>
          </FadeIn>
        </div>
      </div>
    </div>
  );
}
`;

fs.writeFileSync('src/pages/PublicPages.jsx', content + '\n' + pricingComponent);
console.log('Pricing page added!');
