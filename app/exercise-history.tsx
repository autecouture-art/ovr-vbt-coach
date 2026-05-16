import { useEffect } from 'react';
import { useNavigation, useRouter } from 'expo-router';
import ExerciseHistoryScreen from '@/src/screens/ExerciseHistoryScreen';
import DatabaseService from '@/src/services/DatabaseService';

export default function ExerciseHistoryRoute() {
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
      if (name === 'SessionDetail') {
        const sessionId = params?.session_id
          ? String(params.session_id)
          : '';
        router.push({ pathname: '/session-detail', params: { sessionId } });
        return;
      }
    },
  };

  return <ExerciseHistoryScreen navigation={navigation} />;
}
