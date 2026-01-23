/**
 * LVP Graph Screen
 * Load-Velocity Profile visualization
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { VictoryChart, VictoryLine, VictoryScatter, VictoryAxis, VictoryTheme } from 'victory-native';
import DatabaseService from '@services/DatabaseService';
import VBTCalculations from '@utils/VBTCalculations';
import { LVPData, RepData } from '@types/index';

interface LVPScreenProps {
  navigation: any;
  route: any;
}

const LVPScreen: React.FC<LVPScreenProps> = ({ navigation, route }) => {
  const { lift } = route.params || { lift: 'Bench Press' };
  const [lvpData, setLvpData] = useState<LVPData | null>(null);
  const [dataPoints, setDataPoints] = useState<Array<{ x: number; y: number }>>([]);
  const [lvpLine, setLvpLine] = useState<Array<{ x: number; y: number }>>([]);

  useEffect(() => {
    loadLVPData();
  }, [lift]);

  const loadLVPData = async () => {
    try {
      // Get LVP profile from database
      const profile = await DatabaseService.getLVPProfile(lift);

      if (profile) {
        setLvpData(profile);
        generateLVPLine(profile);
      } else {
        // Calculate LVP from historical data
        await calculateLVPFromHistory();
      }
    } catch (error) {
      console.error('Failed to load LVP data:', error);
    }
  };

  const calculateLVPFromHistory = async () => {
    try {
      // Get all sessions
      const sessions = await DatabaseService.getSessions();

      // Collect all reps for this lift
      const allReps: RepData[] = [];
      for (const session of sessions) {
        const sets = await DatabaseService.getSetsForSession(session.session_id);
        for (const set of sets.filter(s => s.lift === lift)) {
          const reps = await DatabaseService.getRepsForSet(
            session.session_id,
            set.lift,
            set.set_index
          );
          allReps.push(...reps);
        }
      }

      // Filter valid reps and create data points
      const validReps = allReps.filter(
        rep => rep.is_valid_rep && rep.mean_velocity !== null && rep.load_kg > 0
      );

      if (validReps.length < 3) {
        console.log('Not enough data to calculate LVP');
        return;
      }

      // Group by load and average velocities
      const loadVelocityMap = new Map<number, number[]>();
      validReps.forEach(rep => {
        const velocities = loadVelocityMap.get(rep.load_kg) || [];
        velocities.push(rep.mean_velocity!);
        loadVelocityMap.set(rep.load_kg, velocities);
      });

      // Calculate average velocity for each load
      const points = Array.from(loadVelocityMap.entries()).map(([load, velocities]) => ({
        load,
        velocity: velocities.reduce((sum, v) => sum + v, 0) / velocities.length,
      }));

      // Calculate LVP
      const lvp = VBTCalculations.calculateLVP(points);
      if (lvp) {
        lvp.lift = lift;
        setLvpData(lvp);
        await DatabaseService.saveLVPProfile(lvp);

        // Set data points for scatter plot
        setDataPoints(points.map(p => ({ x: p.load, y: p.velocity })));

        // Generate LVP line
        generateLVPLine(lvp);
      }
    } catch (error) {
      console.error('Failed to calculate LVP:', error);
    }
  };

  const generateLVPLine = (lvp: LVPData) => {
    if (!dataPoints.length && !lvpData) return;

    // Generate line points
    const minLoad = 20;
    const maxLoad = 200;
    const points = [];

    for (let load = minLoad; load <= maxLoad; load += 10) {
      const velocity = lvp.slope * load + lvp.intercept;
      if (velocity > 0) {
        points.push({ x: load, y: velocity });
      }
    }

    setLvpLine(points);
  };

  const getVelocityZoneColor = (velocity: number): string => {
    if (velocity >= 1.0) return '#FFD700'; // Power
    if (velocity >= 0.75) return '#FF8C00'; // Strength-Speed
    if (velocity >= 0.5) return '#32CD32'; // Hypertrophy
    return '#DC143C'; // Strength
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← 戻る</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Load-Velocity Profile</Text>
      </View>

      <View style={styles.liftCard}>
        <Text style={styles.liftName}>{lift}</Text>
        {lvpData && (
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Vmax</Text>
              <Text style={styles.statValue}>{lvpData.vmax.toFixed(2)} m/s</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>V@1RM</Text>
              <Text style={styles.statValue}>{lvpData.v1rm.toFixed(2)} m/s</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>R²</Text>
              <Text style={styles.statValue}>{lvpData.r_squared.toFixed(3)}</Text>
            </View>
          </View>
        )}
      </View>

      {lvpData && lvpLine.length > 0 ? (
        <View style={styles.chartContainer}>
          <VictoryChart
            theme={VictoryTheme.material}
            width={Dimensions.get('window').width - 32}
            height={300}
            padding={{ top: 20, bottom: 50, left: 50, right: 20 }}
          >
            <VictoryAxis
              label="Load (kg)"
              style={{
                axisLabel: { fill: '#fff', padding: 35, fontSize: 12 },
                axis: { stroke: '#666' },
                tickLabels: { fill: '#999', fontSize: 10 },
                grid: { stroke: '#333' },
              }}
            />
            <VictoryAxis
              dependentAxis
              label="Velocity (m/s)"
              style={{
                axisLabel: { fill: '#fff', padding: 40, fontSize: 12 },
                axis: { stroke: '#666' },
                tickLabels: { fill: '#999', fontSize: 10 },
                grid: { stroke: '#333' },
              }}
            />
            {/* LVP Regression Line */}
            <VictoryLine
              data={lvpLine}
              style={{
                data: { stroke: '#2196F3', strokeWidth: 3 },
              }}
            />
            {/* Actual Data Points */}
            <VictoryScatter
              data={dataPoints}
              size={6}
              style={{
                data: { fill: '#4CAF50' },
              }}
            />
          </VictoryChart>
        </View>
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            LVPデータがありません
          </Text>
          <Text style={styles.emptySubtext}>
            複数の負荷でトレーニングを記録すると、LVPが自動生成されます
          </Text>
        </View>
      )}

      {/* Velocity Zones */}
      <View style={styles.zonesContainer}>
        <Text style={styles.zonesTitle}>速度ゾーン</Text>

        <View style={styles.zoneItem}>
          <View style={[styles.zoneIndicator, { backgroundColor: '#FFD700' }]} />
          <View style={styles.zoneInfo}>
            <Text style={styles.zoneName}>Power</Text>
            <Text style={styles.zoneRange}>≥1.0 m/s | &lt;30% 1RM</Text>
          </View>
        </View>

        <View style={styles.zoneItem}>
          <View style={[styles.zoneIndicator, { backgroundColor: '#FF8C00' }]} />
          <View style={styles.zoneInfo}>
            <Text style={styles.zoneName}>Strength-Speed</Text>
            <Text style={styles.zoneRange}>0.75-1.0 m/s | 30-60% 1RM</Text>
          </View>
        </View>

        <View style={styles.zoneItem}>
          <View style={[styles.zoneIndicator, { backgroundColor: '#32CD32' }]} />
          <View style={styles.zoneInfo}>
            <Text style={styles.zoneName}>Hypertrophy</Text>
            <Text style={styles.zoneRange}>0.5-0.75 m/s | 60-80% 1RM</Text>
          </View>
        </View>

        <View style={styles.zoneItem}>
          <View style={[styles.zoneIndicator, { backgroundColor: '#DC143C' }]} />
          <View style={styles.zoneInfo}>
            <Text style={styles.zoneName}>Strength</Text>
            <Text style={styles.zoneRange}>&lt;0.5 m/s | &gt;80% 1RM</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    color: '#2196F3',
    fontSize: 16,
    marginRight: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  liftCard: {
    margin: 16,
    padding: 20,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
  },
  liftName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  chartContainer: {
    margin: 16,
    padding: 16,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyContainer: {
    margin: 16,
    padding: 40,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  zonesContainer: {
    margin: 16,
    padding: 16,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
  },
  zonesTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  zoneItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  zoneIndicator: {
    width: 20,
    height: 20,
    borderRadius: 4,
    marginRight: 12,
  },
  zoneInfo: {
    flex: 1,
  },
  zoneName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  zoneRange: {
    fontSize: 12,
    color: '#999',
  },
});

export default LVPScreen;
