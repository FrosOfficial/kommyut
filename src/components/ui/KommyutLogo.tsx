// my-app/src/components/ui/KommyutLogo.tsx

import React from 'react';

interface KommyutLogoProps {
  className?: string;
}

export const KommyutLogo: React.FC<KommyutLogoProps> = ({ className = "w-12 h-12" }) => (
  <svg className={className} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="100" cy="100" r="95" fill="#2B5F88"/>
    <path d="M70 60 Q100 40 130 60" stroke="white" strokeWidth="6" fill="none" strokeLinecap="round"/>
    <path d="M80 70 Q100 55 120 70" stroke="white" strokeWidth="6" fill="none" strokeLinecap="round"/>
    <path d="M90 80 Q100 70 110 80" stroke="white" strokeWidth="6" fill="none" strokeLinecap="round"/>
    <circle cx="100" cy="90" r="5" fill="white"/>
    <rect x="50" y="110" width="100" height="30" rx="3" fill="white"/>
    <rect x="55" y="105" width="90" height="5" fill="white"/>
    <rect x="60" y="115" width="20" height="15" fill="#2B5F88"/>
    <rect x="85" y="115" width="20" height="15" fill="#2B5F88"/>
    <rect x="110" y="115" width="20" height="15" fill="#2B5F88"/>
    <circle cx="70" cy="145" r="8" fill="white"/>
    <circle cx="70" cy="145" r="4" fill="#2B5F88"/>
    <circle cx="130" cy="145" r="8" fill="white"/>
    <circle cx="130" cy="145" r="4" fill="#2B5F88"/>
  </svg>
);