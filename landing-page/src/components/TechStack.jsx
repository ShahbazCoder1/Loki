import React from 'react';
import { FaNodeJs, FaDocker } from 'react-icons/fa6';
import { SiExpress, SiElasticsearch, SiKibana, SiOllama, SiGoogle } from 'react-icons/si';
import { VscShield } from 'react-icons/vsc';

const TECH_ITEMS = [
  { name: 'Node.js', icon: <FaNodeJs className="w-14 h-14" /> },
  { name: 'Express', icon: <SiExpress className="w-14 h-14" /> },
  { name: 'Elasticsearch', icon: <SiElasticsearch className="w-14 h-14" /> },
  { name: 'Kibana', icon: <SiKibana className="w-14 h-14" /> },
  { name: 'Ollama', icon: <SiOllama className="w-14 h-14" /> },
  { name: 'Gemma AI', icon: <SiGoogle className="w-14 h-14" /> },
  { name: 'Docker', icon: <FaDocker className="w-14 h-14" /> },
  { name: 'OCSF Schema', icon: <VscShield className="w-14 h-14" /> },
];

export default function TechStack() {
  return (
    <section id="powered-by" className="w-full py-24 overflow-hidden bg-transparent">
      <div className="w-full max-w-7xl mx-auto text-center px-4">
        
        {/* Scaled up the text size and injected distinct top/bottom margins */}
        <div 
          className="text-sm tracking-[0.4em] font-black mt-16 mb-16 uppercase opacity-60" 
          style={{ color: 'var(--text-dim, #64748b)' }}
        >
          POWERED BY
        </div>

        {/* The Marquee Frame Wrapper */}
        <div className="mask-gradient-custom group">
          
          {/* Track 1 */}
          <div className="animate-marquee-custom group-hover:[animation-play-state:paused]">
            {TECH_ITEMS.map((tech, idx) => (
              <div key={`t1-${idx}`} className="marquee-item-custom text-slate-400 grayscale opacity-40 hover:grayscale-0 hover:opacity-100 transition-all duration-300 cursor-pointer">
                {tech.icon}
                <span className="text-3xl font-extrabold tracking-tight">{tech.name}</span>
              </div>
            ))}
          </div>

          {/* Track 2: Duplicate for seamless loop alignment */}
          <div aria-hidden="true" className="animate-marquee-custom group-hover:[animation-play-state:paused]">
            {TECH_ITEMS.map((tech, idx) => (
              <div key={`t2-${idx}`} className="marquee-item-custom text-slate-400 grayscale opacity-40 hover:grayscale-0 hover:opacity-100 transition-all duration-300 cursor-pointer">
                {tech.icon}
                <span className="text-3xl font-extrabold tracking-tight">{tech.name}</span>
              </div>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
}
