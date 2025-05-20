"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { VibeContentRenderer } from '@/components/VibeContentRenderer'; // Используем VibeContentRenderer

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
  };
  labels: {
    navToTop: string;
    navToRoles: string;
    navToArsenal: string;
    navToDashboard: string;
    navToWorkflow: string;
    navToAssets: string;
    navToZion: string;
  };
  sectionsCollapsed: boolean; // To potentially change behavior or appearance if needed
}

const LeadsPageRightNav: React.FC<LeadsPageRightNavProps> = ({
  scrollToSection,
  sectionRefs,
  labels,
  sectionsCollapsed,
}) => {
  const navItems = [
    { ref: sectionRefs.topRef, labelKey: 'navToTop', icon: "::fachevronsup::" },
    { ref: sectionRefs.rolesRef, labelKey: 'navToRoles', icon: "::fausershield::" },
    { ref: sectionRefs.arsenalRef, labelKey: 'navToArsenal', icon: "::fatoolbox::" },
    { ref: sectionRefs.dashboardRef, labelKey: 'navToDashboard', icon: "::fatablelist::" },
    { ref: sectionRefs.workflowRef, labelKey: 'navToWorkflow', icon: "::fadiagramproject::" },
    { ref: sectionRefs.assetsRef, labelKey: 'navToAssets', icon: "::facubes::" },
    { ref: sectionRefs.zionRef, labelKey: 'navToZion', icon: "::facomments::" },
  ];

  return (
    <motion.nav
      className="fixed right-2 sm:right-3 top-1/2 transform -translate-y-1/2 flex flex-col space-y-2 z-40 p-1.5 bg-black/50 backdrop-blur-md rounded-lg border border-gray-700/70 shadow-xl"
      initial={{ x: 100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.3 }}
    >
      {navItems.map((item) => (
        <Button
          key={item.labelKey}
          variant="ghost"
          size="icon"
          onClick={() => scrollToSection(item.ref)}
          className="text-gray-300 hover:bg-brand-orange/20 hover:text-brand-orange w-9 h-9 sm:w-10 sm:h-10 p-0"
          title={labels[item.labelKey as keyof typeof labels]}
          aria-label={labels[item.labelKey as keyof typeof labels]}
        >
          <VibeContentRenderer content={`${item.icon} className='text-lg sm:text-xl'`} />
        </Button>
      ))}
    </motion.nav>
  );
};

export default LeadsPageRightNav;