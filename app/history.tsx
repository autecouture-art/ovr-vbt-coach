import { useEffect } from 'react';
import { useNavigation, useRouter } from 'expo-router';
import HistoryScreen from '@/src/screens/HistoryScreen';
import DatabaseService from '@/src/services/DatabaseService';

export default function HistoryRoute() {
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

      if (name === 'SessionDetail') {
        const sessionId = typeof params?.session === 'object' && params?.session && 'session_id' in params.session
          ? String((params.session as { session_id: string }).session_id)
          : '';
        router.push({ pathname: '/session-detail', params: { sessionId } });
        return;
      }

      if (name === 'CoachChat') return;
    },
  };

  return <HistoryScreen navigation={navigation} />;
}
