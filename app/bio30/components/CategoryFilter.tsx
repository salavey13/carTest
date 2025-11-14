"use client";

import React, { useState, useEffect } from 'react';
import { FilterState } from '../categories/hooks/useBio30';

interface CategoryFilterProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  categories: string[];
  purposes: string[];
  isLoading?: boolean;
}

export function CategoryFilter({ filters, onFilterChange, categories, purposes, isLoading }: CategoryFilterProps) {
  const [localSearch, setLocalSearch] = useState(filters.search);
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  // Debounce search input
  useEffect(() => {
    setLocalSearch(filters.search);
  }, [filters.search]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalSearch(value);
    
    if (debounceTimer) clearTimeout(debounceTimer);
    const timer = setTimeout(() => {
      onFilterChange({ ...filters, search: value });
    }, 300);
    setDebounceTimer(timer);
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({ ...filters, category: e.target.value });
  };

  const handlePurposeToggle = (purpose: string) => {
    const newPurposes = filters.purposes.includes(purpose)
      ? filters.purposes.filter(p => p !== purpose)
      : [...filters.purposes, purpose];
    onFilterChange({ ...filters, purposes: newPurposes });
  };

  const handleTagToggle = (tag: string) => {
    const newTags = filters.tags.includes(tag)
      ? filters.tags.filter(t => t !== tag)
      : [...filters.tags, tag];
    onFilterChange({ ...filters, tags: newTags });
  };

  const handleCheckboxChange = (field: keyof FilterState) => {
    onFilterChange({ ...filters, [field]: !filters[field] });
  };

  const handleClearAll = () => {
    onFilterChange({
      category: 'Все категории',
      search: '',
      minPrice: 0,
      maxPrice: 5000,
      purposes: [],
      tags: [],
      inStockOnly: false,
      hasDiscount: false
    });
  };

  if (isLoading) {
    return (
      <div className="flex gap-4 p-4">
        <div className="animate-pulse bg-muted h-10 flex-1 rounded-md"></div>
        <div className="animate-pulse bg-muted h-10 flex-1 rounded-md"></div>
        <div className="animate-pulse bg-muted h-10 w-24 rounded-md"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 border-b border-border">
      {/* Top Filter Bar */}
      <div className="flex flex-wrap gap-4 items-center">
        {/* Category Select */}
        <select 
          value={filters.category}
          onChange={handleCategoryChange}
          className="min-w-[150px] bg-background border border-input rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:border-ring"
        >
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>

        {/* Search Input */}
        <input 
          type="text" 
          placeholder="Поиск по продуктам..." 
          value={localSearch}
          onChange={handleSearchChange}
          className="flex-1 min-w-[200px] bg-background border border-input rounded-md px-3 py-2 text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:border-ring"
        />

        {/* Clear Filters */}
        <button 
          onClick={handleClearAll}
          className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-md text-sm font-medium transition-colors whitespace-nowrap"
        >
          Сбросить всё
        </button>
      </div>

      {/* Filter Tags Section */}
      <div className="flex flex-wrap gap-6">
        {/* Purposes */}
        {purposes.length > 0 && (
          <div className="flex flex-col gap-2">
            <h4 className="text-sm font-semibold text-foreground/70">Назначение</h4>
            <div className="flex flex-wrap gap-2">
              {purposes.map(purpose => (
                <label key={purpose} className="flex items-center gap-2 px-3 py-1.5 bg-card border border-border rounded-md cursor-pointer hover:bg-muted/50">
                  <input
                    type="checkbox"
                    checked={filters.purposes.includes(purpose)}
                    onChange={() => handlePurposeToggle(purpose)}
                    className="w-4 h-4 accent-primary"
                  />
                  <span className="text-sm">{purpose}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Predefined Tags */}
        <div className="flex flex-col gap-2">
          <h4 className="text-sm font-semibold text-foreground/70">Теги</h4>
          <div className="flex flex-wrap gap-2">
            {['bestseller', 'for_women', 'for_men', 'complex'].map(tag => (
              <label key={tag} className="flex items-center gap-2 px-3 py-1.5 bg-card border border-border rounded-md cursor-pointer hover:bg-muted/50">
                <input
                  type="checkbox"
                  checked={filters.tags.includes(tag)}
                  onChange={() => handleTagToggle(tag)}
                  className="w-4 h-4 accent-primary"
                />
                <span className="text-sm capitalize">{tag.replace('_', ' ')}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Stock & Discount Checkboxes */}
        <div className="flex flex-col gap-2">
          <h4 className="text-sm font-semibold text-foreground/70">Дополнительно</h4>
          <div className="flex flex-wrap gap-3">
            <label className="flex items-center gap-2 px-3 py-1.5 bg-card border border-border rounded-md cursor-pointer hover:bg-muted/50">
              <input
                type="checkbox"
                checked={filters.inStockOnly}
                onChange={() => handleCheckboxChange('inStockOnly')}
                className="w-4 h-4 accent-primary"
              />
              <span className="text-sm">Только в наличии</span>
            </label>
            <label className="flex items-center gap-2 px-3 py-1.5 bg-card border border-border rounded-md cursor-pointer hover:bg-muted/50">
              <input
                type="checkbox"
                checked={filters.hasDiscount}
                onChange={() => handleCheckboxChange('hasDiscount')}
                className="w-4 h-4 accent-primary"
              />
              <span className="text-sm">Только со скидкой</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}