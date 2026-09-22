import React from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Features from './components/Features';
import PipelineSteps from './components/PipelineSteps';
import ApiDocs from './components/ApiDocs';
import TechStack from './components/TechStack';
import Footer from './components/Footer';

function App() {
  return (
    <>
      <Navbar />
      <Hero />
      <Features />
      <PipelineSteps />
      <ApiDocs />
      <TechStack />
      <Footer />
    </>
  );
}

export default App;
