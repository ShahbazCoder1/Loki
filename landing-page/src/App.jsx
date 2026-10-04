import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Features from './components/Features';
import PipelineArchitecture from './components/PipelineArchitecture';
import Architecture from './components/Architecture';
import EventTraceability from './components/EventTraceability';
import SupportedFormats from './components/SupportedFormats';
import TechStack from './components/TechStack';
import FinalCTA from './components/FinalCTA';
import Footer from './components/Footer';
import DocsModal from './components/DocsModal';

function App() {
  const [docsModalOpen, setDocsModalOpen] = useState(false);

  useEffect(() => {
    const observerCallback = (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed');
          observer.unobserve(entry.target);
        }
      });
    };

    const observerOptions = {
      root: null,
      rootMargin: '0px 0px -40px 0px',
      threshold: 0.15,
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);
    const revealElements = document.querySelectorAll('.reveal-section');

    revealElements.forEach((el) => observer.observe(el));

    return () => {
      revealElements.forEach((el) => observer.unobserve(el));
    };
  }, []);

  return (
    <div className="app-wrapper">
      <div className="bg-grid-pattern"></div>
      
      <Navbar onOpenDocs={() => setDocsModalOpen(true)} />
      <Hero />
      <Features />
      <PipelineArchitecture />
      <Architecture />
      <EventTraceability />
      <SupportedFormats />
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
