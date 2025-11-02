"use client";

import React from 'react';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import '../../styles.css';

const LionSManePage: React.FC = () => {
  return (
    <div>
      <Header />
      {/* Extract from lion-s-mane.txt, including product details, form to add to cart */}
      <div className="product">
        <h1>Lion's Mane</h1>
        {/* Benefits, description, etc. */}
      </div>
      <Footer />
    </div>
  );
};

export default LionSManePage;