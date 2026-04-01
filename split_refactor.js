import * as fs from 'fs';

let content = fs.readFileSync('src/App.jsx', 'utf8');

// The shared imports needed by the split files
// We will insert this at the top of each new file
const sharedImports = `import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Search, MapPin, Building, Star, Filter, 
  CheckCircle, ArrowRight, User, Briefcase, 
  Menu, X, Calculator, PieChart, ShieldCheck, 
  Mail, Lock, LogOut, Sparkles, Layers3, 
  BarChart3, BadgeCheck, Clock3, Handshake, 
  Globe2, TrendingDown, ChevronDown, ChevronUp,
  Bookmark, MessageSquare, Bell, SlidersHorizontal,
  ChevronRight, FileText, Calendar, Video, Download, CreditCard, Receipt,
  DollarSign, CheckSquare, Settings, Bot, Send, Loader2
} from 'lucide-react';
import { REVIEWS, TALENT_PROFILES, AGENCIES, SERVICE_CARDS, PROCESS_STEPS, FAQ_DATA } from '../data/mockData';
import FadeIn from '../components/FadeIn';

`;

// Regular expressions to find the start of each major section
const publicStart = content.indexOf('// =========================================='); // Start of 1. PUBLIC MARKETING SITE
const clientStart = content.indexOf('// 2. CLIENT PORTAL (LOGGED IN EXPERIENCE)'); // Start of 2. CLIENT PORTAL
const profStart = content.indexOf('// 3. PROFESSIONAL PORTAL (TALENT EXPERIENCE)'); // Start of 3. PROFESSIONAL PORTAL

if (publicStart > -1 && clientStart > -1 && profStart > -1) {
  // Extract chunks
  const appComponentChunk = content.substring(0, publicStart);
  
  // Need to adjust index to grab the separator line properly
  const clientStartIndex = content.lastIndexOf('// ==========================================', clientStart);
  const profStartIndex = content.lastIndexOf('// ==========================================', profStart);

  const publicChunk = content.substring(publicStart, clientStartIndex);
  const clientChunk = content.substring(clientStartIndex, profStartIndex);
  const profChunk = content.substring(profStartIndex);

  // Write new files
  fs.writeFileSync('src/pages/PublicPages.jsx', sharedImports + publicChunk);
  fs.writeFileSync('src/pages/ClientPages.jsx', sharedImports + clientChunk);
  fs.writeFileSync('src/pages/ProfessionalPages.jsx', sharedImports + profChunk);

  // Update App.jsx to import these components
  // We need to export them from their respective files, so we modify the chunks to export the main components
  // Or better yet, we just export them in the files
  fs.writeFileSync('src/pages/PublicPages.jsx', sharedImports + publicChunk.replace('function PublicSite', 'export function PublicSite'));
  fs.writeFileSync('src/pages/ClientPages.jsx', sharedImports + clientChunk.replace('function ClientPortal', 'export function ClientPortal'));
  fs.writeFileSync('src/pages/ProfessionalPages.jsx', sharedImports + profChunk.replace('function ProfessionalPortal', 'export function ProfessionalPortal'));

  // Update App.jsx
  const newAppImports = `import { PublicSite } from './pages/PublicPages';
import { ClientPortal } from './pages/ClientPages';
import { ProfessionalPortal } from './pages/ProfessionalPages';\n\n`;

  const newAppContent = appComponentChunk.replace('// --- MAIN APP COMPONENT ---', newAppImports + '// --- MAIN APP COMPONENT ---');
  fs.writeFileSync('src/App.jsx', newAppContent);

  console.log('Successfully split files!');
} else {
  console.log('Failed to find split points');
}
