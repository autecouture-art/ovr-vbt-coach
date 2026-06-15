import { useEffect } from 'react';
import { useNavigation, useRouter } from 'expo-router';
import MonitorScreen from '@/src/screens/MonitorScreen';
import DatabaseService from '@/src/services/DatabaseService';

export default function MonitorRoute() {
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

  return <MonitorScreen navigation={navigation} />;
}
