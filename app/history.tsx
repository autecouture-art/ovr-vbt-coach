import { useEffect } from 'react';
import { useNavigation, useRouter } from 'expo-router';
import HistoryScreen from '@/src/screens/HistoryScreen';
import DatabaseService from '@/src/services/DatabaseService';
import { serializeRouteParams } from '@/src/utils/routeParams';

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
      router.replace('/');
    },
    navigate: (name: string, params?: Record<string, unknown>) => {
      if (name === 'Home') {
        router.replace('/');
        return;
      }

      if (name === 'SessionDetail') {
        const sessionId = typeof params?.session === 'object' && params?.session && 'session_id' in params.session
          ? String((params.session as { session_id: string }).session_id)
          : '';
        router.push({ pathname: '/session-detail', params: { sessionId } });
        return;
      }

      if (name === 'CoachChat') {
        router.push({
          pathname: '/coach-chat',
          params: serializeRouteParams(params),
        });
      }
    },
  };

  return <HistoryScreen navigation={navigation} />;
}
