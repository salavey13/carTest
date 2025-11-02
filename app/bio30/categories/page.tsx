"use client";

import React from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import '../styles.css';

const CategoriesPage: React.FC = () => {
  return (
    <div>
      <Header />
      <div className="grid grid--categories">
        <div className="card card__default">
          <div className="aside">
            <div className="title fs__lg fw__bd">Категория 1</div>
            {/* Add category details */}
          </div>
          {/* Bside with image or content */}
        </div>
        {/* More categories */}
      </div>
      <Footer />
    </div>
  );
};

export default CategoriesPage;