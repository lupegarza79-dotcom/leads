import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';

const STORAGE_KEY = 'mg_custom_carriers_v1';

export const [CustomCarriersProvider, useCustomCarriers] = createContextHook(() => {
  const [carriers, setCarriers] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as string[];
          if (Array.isArray(parsed)) {
            setCarriers(parsed.filter((x) => typeof x === 'string'));
          }
        }
      } catch (e) {
        console.log('[CustomCarriers] Load error:', e);
      } finally {
        setIsLoaded(true);
      }
    })();
  }, []);

  const addCarrier = useCallback(async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setCarriers((prev) => {
      if (prev.some((c) => c.toLowerCase() === trimmed.toLowerCase())) return prev;
      const next = [trimmed, ...prev].slice(0, 20);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch((e) =>
        console.log('[CustomCarriers] Save error:', e),
      );
      return next;
    });
  }, []);

  return { customCarriers: carriers, addCustomCarrier: addCarrier, isLoaded };
});
