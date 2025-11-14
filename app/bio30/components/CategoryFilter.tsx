"use client";

import React, { useState, useEffect } from 'react';
import { getUniqueCategories, getUniquePurposes } from '../categories/actions';
import { logger } from "@/lib/logger";

interface CategoryFilterProps {
  onFilterChange: (filters: FilterState) => void;
  initialFilters?: FilterState;
}

export interface FilterState {
  category: string;
  search: string;
  minPrice: number;
  maxPrice: number;
  purposes: string[];
  inStockOnly: boolean;
  hasDiscount: boolean;
}

const CategoryFilter: React.FC<CategoryFilterProps> = ({ onFilterChange, initialFilters }) => {
  const [categories, setCategories] = useState<string[]>([]);
  const [purposes, setPurposes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [filters, setFilters] = useState<FilterState>({
    category: 'Все категории',
    search: '',
    minPrice: 0,
    maxPrice: 5000,
    purposes: [],
    inStockOnly: false,
    hasDiscount: false,
    ...initialFilters
  });

  useEffect(() => {
    loadFilterOptions();
  }, []);

  useEffect(() => {
    // Debounce filter changes to avoid excessive updates
    const timer = setTimeout(() => {
      onFilterChange(filters);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [filters, onFilterChange]);

  const loadFilterOptions = async () => {
    try {
      setIsLoading(true);
      
      const [categoriesResult, purposesResult] = await Promise.all([
        getUniqueCategories(),
        getUniquePurposes()
      ]);

      if (categoriesResult.success) {
        setCategories(categoriesResult.data || []);
      } else {
        logger.error("Failed to load categories:", categoriesResult.error);
        setCategories(['Все категории', 'Пищевая добавка']);
      }

      if (purposesResult.success) {
        setPurposes(purposesResult.data || []);
      } else {
        logger.error("Failed to load purposes:", purposesResult.error);
        setPurposes(['Иммунитет', 'Энергия', 'Память']);
      }
    } catch (err) {
      logger.error("Error loading filter options:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilters(prev => ({ ...prev, category: e.target.value }));
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters(prev => ({ ...prev, search: e.target.value }));
  };

  const handlePurposeToggle = (purpose: string) => {
    setFilters(prev => ({
      ...prev,
      purposes: prev.purposes.includes(purpose)
        ? prev.purposes.filter(p => p !== purpose)
        : [...prev.purposes, purpose]
    }));
  };

  const handleCheckboxChange = (field: 'inStockOnly' | 'hasDiscount') => {
    setFilters(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const handleClearFilters = () => {
    setFilters({
      category: 'Все категории',
      search: '',
      minPrice: 0,
      maxPrice: 5000,
      purposes: [],
      inStockOnly: false,
      hasDiscount: false
    });
  };

  if (isLoading) {
    return (
      <div className="filter row gp gp--md pd pd__md--top pd pd__md--btm">
        <div className="animate-pulse bg-muted rounded-md h-10 w-full"></div>
        <div className="animate-pulse bg-muted rounded-md h-10 w-full"></div>
        <div className="animate-pulse bg-muted rounded-md h-10 w-24"></div>
      </div>
    );
  }

  return (
    <div className="filter row gp gp--md pd pd__md--top pd pd__md--btm flex-wrap">
      {/* Category Dropdown */}
      <select 
        className="select fs__md fw__rg min-w-[150px]"
        value={filters.category}
        onChange={handleCategoryChange}
      >
        {categories.map(cat => (
          <option key={cat} value={cat}>{cat}</option>
        ))}
      </select>

      {/* Search Input */}
      <input 
        type="text" 
        placeholder="Поиск по продуктам..." 
        className="input fs__md fw__rg flex-1 min-w-[200px]"
        value={filters.search}
        onChange={handleSearchChange}
      />

      {/* Purpose Tags */}
      <div className="flex gap-2 flex-wrap">
        {purposes.slice(0, 6).map(purpose => (
          <label key={purpose} className="flex items-center gap-1 px-2 py-1 bg-muted rounded-md cursor-pointer hover:bg-muted/80">
            <input
              type="checkbox"
              className="ui-checkbox"
              checked={filters.purposes.includes(purpose)}
              onChange={() => handlePurposeToggle(purpose)}
            />
            <span className="text-sm">{purpose}</span>
          </label>
        ))}
      </div>

      {/* Action Buttons */}
      <button 
        className="btn btn--primary fs__md fw__rg whitespace-nowrap"
        onClick={() => onFilterChange(filters)}
      >
        Применить
      </button>
      <button 
        className="btn btn--secondary fs__md fw__rg whitespace-nowrap"
        onClick={handleClearFilters}
      >
        Сбросить
      </button>
    </div>
  );
};

export default CategoryFilter;