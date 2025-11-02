"use client";

import React from 'react';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import '../../styles.css';

const LionSManePage: React.FC = () => {
  return (
    <div>
      <Header />
      <div className="product">
        <h1>Lion's Mane</h1>
        <div className="description">Lion's Mane, также известный как грива льва или гриб-геркулес...</div>
        <div className="grid grid--product">
          <div className="benefit">Benefit 1</div>
          {/* Add benefits, images, etc. from lion-s-mane.txt */}
        </div>
        <form action="/cart/add/31?lang=ru&amp;region=ru" method="POST">
          <button type="submit" className="btn btn--wht btn__primary">Добавить в корзину</button>
        </form>
      </div>
      <Footer />
    </div>
  );
};

export default LionSManePage;