import { useEffect } from 'react';
import { useNavigation, useRouter } from 'expo-router';
import ManualEntryScreen from '@/src/screens/ManualEntryScreen';
import DatabaseService from '@/src/services/DatabaseService';
import { serializeRouteParams } from '@/src/utils/routeParams';

export default function ManualEntryRoute() {
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

      if (name === 'CoachChat') {
        router.push({
          pathname: '/coach-chat',
          params: serializeRouteParams(params),
        });
      }
    },
  };

  return <ManualEntryScreen navigation={navigation} />;
}
