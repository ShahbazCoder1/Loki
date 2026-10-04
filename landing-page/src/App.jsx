import React, { useState } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Architecture from './components/Architecture';
import EventTraceability from './components/EventTraceability';
import SupportedFormats from './components/SupportedFormats';
import TechStack from './components/TechStack';
import Footer from './components/Footer';
import DocsModal from './components/DocsModal';

function App() {
  const [docsModalOpen, setDocsModalOpen] = useState(false);

  return (
    <div className="app-wrapper">
      <div className="bg-grid-pattern"></div>
      
      <Navbar onOpenDocs={() => setDocsModalOpen(true)} />
      <Hero />
      <Architecture />
      <EventTraceability />
      <SupportedFormats />
      <TechStack />
      <Footer />

      <DocsModal
        isOpen={docsModalOpen}
        onClose={() => setDocsModalOpen(false)}
      />
    </div>
  );
}

export default App;
