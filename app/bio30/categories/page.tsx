"use client";

import React from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import '../styles.css';

const CategoriesPage: React.FC = () => {
  return (
    <div>
      <Header />
      {/* Extract content from categories.txt, e.g., grid--categories */}
      <div className="grid grid--categories">
        {/* Category cards */}
      </div>
      <Footer />
    </div>
  );
};

export default CategoriesPage;