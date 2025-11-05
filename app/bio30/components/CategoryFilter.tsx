"use client";

import React from 'react';

const CategoryFilter: React.FC = () => {
  return (
    <div className="filter row gp gp--md pd pd__md--top pd__md--btm">
      <input type="text" placeholder="Поиск по категориям" className="input fs__md fw__rg" />
      <button className="btn btn--primary fs__md fw__rg">Фильтр</button>
    </div>
  );
};

export default CategoryFilter;