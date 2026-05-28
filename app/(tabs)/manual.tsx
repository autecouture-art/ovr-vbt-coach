import { useEffect } from 'react';
import { useNavigation, useRouter } from 'expo-router';

import ManualEntryScreen from '@/src/screens/ManualEntryScreen';
import DatabaseService from '@/src/services/DatabaseService';

export default function ManualTabRoute() {
  const router = useRouter();
  const navigationState = useNavigation();

  useEffect(() => {
    void DatabaseService.initialize();
  }, []);

  const navigation = {
    goBack: () => {
      if (navigationState.canGoBack()) {
        router.back();
        return;
      }
      router.replace('/(tabs)');
    },
    navigate: (name: string, params?: Record<string, unknown>) => {
      if (name === 'Home') {
        router.replace('/(tabs)');
        return;
      }

      if (name === 'CoachChat') return;
    },
  };

  return <ManualEntryScreen navigation={navigation} />;
}
