import React, { useState, useRef } from 'react';
import { StyleSheet, Animated, PanResponder, Dimensions, View } from 'react-native';
import { Bug } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import DevToolsPanel from './DevToolsPanel';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const FAB_SIZE = 44;

export default function DevToolsFAB() {
  const [showPanel, setShowPanel] = useState<boolean>(false);
  const pan = useRef(new Animated.ValueXY({ x: SCREEN_W - FAB_SIZE - 16, y: SCREEN_H - 160 })).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 4 || Math.abs(gs.dy) > 4,
      onPanResponderGrant: () => {
        pan.setOffset({ x: (pan.x as any)._value, y: (pan.y as any)._value });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_, gs) => {
        pan.flattenOffset();
        if (Math.abs(gs.dx) < 5 && Math.abs(gs.dy) < 5) {
          setShowPanel(true);
        }
      },
    })
  ).current;

  if (!__DEV__) return null;

  return (
    <>
      <Animated.View
        style={[
          styles.fab,
          { transform: pan.getTranslateTransform() },
        ]}
        {...panResponder.panHandlers}
      >
        <View style={styles.fabInner}>
          <Bug size={20} color={Colors.white} />
        </View>
      </Animated.View>
      <DevToolsPanel visible={showPanel} onClose={() => setShowPanel(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    zIndex: 9999,
  },
  fabInner: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: 'rgba(59,130,246,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
});
