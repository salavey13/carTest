"use client";

import { useState, useEffect, useCallback } from 'react';
import { fetchBio30Products, getUniqueCategories, getUniquePurposes } from '../actions';
import { useAppToast } from '@/hooks/useAppToast';
import { logger } from '@/lib/logger';
import type { Bio30Product } from '../actions';

export interface FilterState {
  category: string;
  search: string;
  minPrice: number;
  maxPrice: number;
  purposes: string[];
  tags: string[];
  inStockOnly: boolean;
  hasDiscount: boolean;
}

export function useBio30() {
  const [products, setProducts] = useState<Bio30Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Bio30Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [purposes, setPurposes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    category: 'Все категории',
    search: '',
    minPrice: 0,
    maxPrice: 5000,
    purposes: [],
    tags: [],
    inStockOnly: false,
    hasDiscount: false
  });

  const toast = useAppToast();

  // Initial load
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setIsLoading(true);
      toast.loading('Загрузка данных...', { id: 'loading-bio30' });

      const [productsResult, categoriesResult, purposesResult] = await Promise.all([
        fetchBio30Products(),
        getUniqueCategories(),
        getUniquePurposes()
      ]);

      if (!productsResult.success) throw new Error(productsResult.error);
      if (!categoriesResult.success) throw new Error(categoriesResult.error);
      if (!purposesResult.success) throw new Error(purposesResult.error);

      setProducts(productsResult.data || []);
      setFilteredProducts(productsResult.data || []);
      setCategories(categoriesResult.data || []);
      setPurposes(purposesResult.data || []);

      toast.success(`Загружено ${productsResult.data?.length || 0} продуктов`);
    } catch (err) {
      logger.error('Failed to load BIO30 data:', err);
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
      toast.error('Ошибка загрузки данных');
    } finally {
      setIsLoading(false);
      toast.dismiss('loading-bio30');
    }
  };

  // Apply filters
  const applyFilters = useCallback(async (newFilters: FilterState) => {
    setFilters(newFilters);
    setIsLoading(true);
    
    try {
      toast.loading('Применение фильтров...', { id: 'applying-filters' });
      
      const result = await fetchBio30Products({
        ...newFilters,
        purpose: newFilters.purposes
      });
      
      if (!result.success) throw new Error(result.error);
      
      setFilteredProducts(result.data || []);
      toast.success(`Найдено ${result.data?.length || 0} продуктов`);
    } catch (err) {
      logger.error('Filter error:', err);
      toast.error('Ошибка применения фильтров');
      setFilteredProducts(products); // Fallback
    } finally {
      setIsLoading(false);
      toast.dismiss('applying-filters');
    }
  }, [products]);

  // Reset filters
  const resetFilters = useCallback(() => {
    const defaultFilters = {
      category: 'Все категории',
      search: '',
      minPrice: 0,
      maxPrice: 5000,
      purposes: [],
      tags: [],
      inStockOnly: false,
      hasDiscount: false
    };
    applyFilters(defaultFilters);
  }, [applyFilters]);

  // Update price range from slider
  const updatePriceRange = useCallback((min: number, max: number) => {
    const newFilters = { ...filters, minPrice: min, maxPrice: max };
    setFilters(newFilters);
    applyFilters(newFilters);
  }, [filters, applyFilters]);

  return {
    products,
    filteredProducts,
    categories,
    purposes,
    isLoading,
    error,
    filters,
    applyFilters,
    resetFilters,
    updatePriceRange
  };
}