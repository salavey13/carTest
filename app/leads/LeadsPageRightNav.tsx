// /app/leads/LeadsPageRightNav.tsx
"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { VibeContentRenderer } from '@/components/VibeContentRenderer'; 

interface LeadsPageRightNavProps {
  scrollToSection: (ref: React.RefObject<HTMLDivElement>) => void;
  sectionRefs: {
    topRef: React.RefObject<HTMLDivElement>;
    rolesRef: React.RefObject<HTMLDivElement>;
    arsenalRef: React.RefObject<HTMLDivElement>;
    dashboardRef: React.RefObject<HTMLDivElement>;
    workflowRef: React.RefObject<HTMLDivElement>;
    assetsRef: React.RefObject<HTMLDivElement>;
    zionRef: React.RefObject<HTMLDivElement>;
    scraperRef: React.RefObject<HTMLDivElement>; // Добавляем реф для скрейпера
  };
  labels: {
    navToTop: string;
    navToRoles: string;
    navToArsenal: string;
    navToDashboard: string;
    navToWorkflow: string;
    navToAssets: string;
    navToZion: string;
    navToScraper: string; // Добавляем label для скрейпера
  };
  sectionsCollapsed: boolean; 
}

const LeadsPageRightNav: React.FC<LeadsPageRightNavProps> = ({
  scrollToSection,
  sectionRefs,
  labels,
  sectionsCollapsed,
}) => {
  const allNavItems = [
    { ref: sectionRefs.topRef, labelKey: 'navToTop', iconName: "FaChevronUp", alwaysVisible: true }, 
    { ref: sectionRefs.rolesRef, labelKey: 'navToRoles', iconName: "FaShieldCat", alwaysVisible: false },
    { ref: sectionRefs.scraperRef, labelKey: 'navToScraper', iconName: "FaSpider", alwaysVisible: true }, // Добавляем скрейпер
    { ref: sectionRefs.arsenalRef, labelKey: 'navToArsenal', iconName: "FaToolbox", alwaysVisible: true },
    { ref: sectionRefs.dashboardRef, labelKey: 'navToDashboard', iconName: "FaTableList", alwaysVisible: true },
    { ref: sectionRefs.workflowRef, labelKey: 'navToWorkflow', iconName: "FaDiagramProject", alwaysVisible: false },
    { ref: sectionRefs.assetsRef, labelKey: 'navToAssets', iconName: "FaCubes", alwaysVisible: false },
    { ref: sectionRefs.zionRef, labelKey: 'navToZion', iconName: "FaComments", alwaysVisible: false },
  ];

  const visibleNavItems = allNavItems.filter(item => 
    item.alwaysVisible || !sectionsCollapsed
  );

  return (
    <motion.nav
      className="fixed right-2 sm:right-3 top-1/2 transform -translate-y-1/2 flex flex-col space-y-2 z-40 p-1.5 bg-black/50 backdrop-blur-md rounded-lg border border-gray-700/70 shadow-xl"
      initial={{ x: 100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.3 }}
    >
      {visibleNavItems.map((item) => (
        <Button
          key={item.labelKey}
          variant="ghost"
          size="icon"
          onClick={() => scrollToSection(item.ref)}
          className="text-gray-300 hover:bg-brand-orange/20 hover:text-brand-orange w-9 h-9 sm:w-10 sm:h-10 p-0"
          title={labels[item.labelKey as keyof typeof labels]}
          aria-label={labels[item.labelKey as keyof typeof labels]}
        >
          <VibeContentRenderer content={`::${item.iconName} className='text-lg sm:text-xl'::`} />
        </Button>
      ))}
    </motion.nav>
  );
};

export default LeadsPageRightNav;