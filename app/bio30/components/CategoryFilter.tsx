"use client";

import React from 'react';

const CategoryFilter: React.FC = () => {
  return (
    <div className="filter row gp gp--md pd pd__md--top pd__md--btm">
      <select className="select fs__md fw__rg">
        <option>Все категории</option>
        <option>Витамины</option>
        <option>Минералы</option>
        <option>Иммунитет</option>
        <option>Красота</option>
      </select>
      <input type="text" placeholder="Поиск по категориям" className="input fs__md fw__rg" />
      <button className="btn btn--primary fs__md fw__rg">Фильтр</button>
    </div>
  );
};

export default CategoryFilter;