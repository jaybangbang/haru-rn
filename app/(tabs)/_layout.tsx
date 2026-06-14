import { Tabs } from 'expo-router';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { PAL } from '@/constants/palette';
import { HomeIcon, ChartIcon, SearchIcon } from '@/components/Icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function TabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();
  const TABS = [
    { key: 'index', label: '홈', Icon: HomeIcon },
    { key: 'weekly', label: '주간', Icon: ChartIcon },
    { key: 'search', label: '검색', Icon: SearchIcon },
  ];

  return (
    <View style={[styles.barWrap, { paddingBottom: insets.bottom + 4 }]}>
      <View style={styles.bar}>
        {state.routes.map((route: any, i: number) => {
          const isFocused = state.index === i;
          const tab = TABS[i];
          if (!tab) return null;
          return (
            <Pressable
              key={route.key}
              onPress={() => navigation.navigate(route.name)}
              style={styles.tabBtn}
            >
              <tab.Icon size={22} color={isFocused ? PAL.indigoDeep : PAL.muted} filled={isFocused} />
              <Text style={[styles.tabLabel, { color: isFocused ? PAL.indigoDeep : PAL.muted, fontWeight: isFocused ? '600' : '500' }]}>
                {tab.label}
              </Text>
              {isFocused && <View style={styles.activeDot} />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs tabBar={props => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="weekly" />
      <Tabs.Screen name="search" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  barWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    paddingTop: 0,
    backgroundColor: 'transparent',
    pointerEvents: 'box-none',
  },
  bar: {
    backgroundColor: 'rgba(251,246,234,0.92)',
    borderRadius: 28,
    paddingHorizontal: 8,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-around',
    borderWidth: 1,
    borderColor: PAL.line,
    shadowColor: PAL.indigoDeep,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 12,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    gap: 3,
    position: 'relative',
  },
  tabLabel: {
    fontSize: 10,
    letterSpacing: 0.2,
  },
  activeDot: {
    position: 'absolute',
    bottom: -2,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: PAL.amber,
  },
});
