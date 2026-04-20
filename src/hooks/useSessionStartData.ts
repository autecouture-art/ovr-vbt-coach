/**
 * useSessionStartData Hook
 * Fetches and manages session start data
 */

import { useState, useEffect } from 'react';
import SessionStartService from '../services/SessionStartService';
import type { Exercise } from '../types/index';
import type { SessionStartData } from '../services/SessionStartService';

export function useSessionStartData(exercise: Exercise | null, currentLoad: number) {
  const [data, setData] = useState<SessionStartData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = async () => {
    if (!exercise) {
      setData(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const sessionStartData = await SessionStartService.getSessionStartData(
        exercise,
        currentLoad
      );
      setData(sessionStartData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch session start data'));
      console.error('Error fetching session start data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [exercise?.name, currentLoad]);

  const refetch = () => {
    fetchData();
  };

  return {
    data,
    loading,
    error,
    refetch,
  };
}
