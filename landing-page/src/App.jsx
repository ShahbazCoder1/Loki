import React, { useState } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Features from './components/Features';
import PipelineArchitecture from './components/PipelineArchitecture';
import UnknownLogIntelligence from './components/UnknownLogIntelligence';
import HumanInTheLoop from './components/HumanInTheLoop';
import EventTraceability from './components/EventTraceability';
import KibanaObservability from './components/KibanaObservability';
import SupportedFormats from './components/SupportedFormats';
import GettingStarted from './components/GettingStarted';
import TechStack from './components/TechStack';
import FinalCTA from './components/FinalCTA';
import Footer from './components/Footer';
import DocsModal from './components/DocsModal';

function App() {
  const [docsModalOpen, setDocsModalOpen] = useState(false);

  return (
    <div className="app-wrapper">
      <div className="bg-grid-pattern"></div>
      
      <Navbar onOpenDocs={() => setDocsModalOpen(true)} />
      <Hero />
      <Features />
      <PipelineArchitecture />
      <UnknownLogIntelligence />
      <HumanInTheLoop />
      <EventTraceability />
      <KibanaObservability />
      <SupportedFormats />
      <GettingStarted onOpenDocs={() => setDocsModalOpen(true)} />
      <TechStack />
      <FinalCTA />
      <Footer />

      <DocsModal
        isOpen={docsModalOpen}
        onClose={() => setDocsModalOpen(false)}
      />
    </div>
  );
}

export default App;
