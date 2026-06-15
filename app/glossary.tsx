/**
 * Glossary Screen Route
 */

import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import GlossaryScreen from '@/src/screens/GlossaryScreen';

export default function GlossaryRoute() {
  return (
    <>
      <StatusBar style="light" />
      <View style={{ flex: 1 }}>
        <GlossaryScreen />
      </View>
    </>
  );
}
