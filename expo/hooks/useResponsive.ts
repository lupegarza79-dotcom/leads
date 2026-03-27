import { useState, useEffect } from 'react';
import { Dimensions } from 'react-native';

interface ResponsiveInfo {
  width: number;
  height: number;
  isWide: boolean;
  isDesktop: boolean;
  columns: number;
}

export function useResponsive(): ResponsiveInfo {
  const [dimensions, setDimensions] = useState(() => Dimensions.get('window'));

  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
    });
    return () => sub.remove();
  }, []);

  const isWide = dimensions.width >= 768;
  const isDesktop = dimensions.width >= 1024;
  const columns = isDesktop ? 3 : isWide ? 2 : 1;

  return {
    width: dimensions.width,
    height: dimensions.height,
    isWide,
    isDesktop,
    columns,
  };
}
