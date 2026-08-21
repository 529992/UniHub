import { useRef, useState } from 'react';
import {
  Animated,
  Image,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import WebView from 'react-native-webview';

const menuIcon = require('./assets/centerButton_icon.png');
const homePageUrl = 'https://lms.lpec.lk/login/index.php';
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [homePageKey, setHomePageKey] = useState(0);
  const menuSlideRef = useRef<Animated.Value | null>(null);
  const buttonRotationRef = useRef<Animated.Value | null>(null);

  if (!menuSlideRef.current) {
    menuSlideRef.current = new Animated.Value(0);
  }

  if (!buttonRotationRef.current) {
    buttonRotationRef.current = new Animated.Value(0);
  }

  const menuSlide = menuSlideRef.current;
  const buttonRotation = buttonRotationRef.current;

  const closeMenu = () => {
    Animated.parallel([
      Animated.timing(menuSlide, {
        duration: 220,
        toValue: 0,
        useNativeDriver: true,
      }),
      Animated.timing(buttonRotation, {
        duration: 220,
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start(() => setMenuOpen(false));
  };

  const openMenu = () => {
    setMenuOpen(true);
    Animated.parallel([
      Animated.timing(menuSlide, {
        duration: 280,
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(buttonRotation, {
        duration: 280,
        toValue: 1,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const toggleMenu = () => {
    if (menuOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  };

  const goHome = () => {
    setHomePageKey(current => current + 1);
    closeMenu();
  };

  const buttonRotationStyle = {
    rotate: buttonRotation.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '180deg'],
    }),
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <WebView
        key={homePageKey}
        originWhitelist={['*']}
        source={{ uri: homePageUrl }}
        style={styles.webView}
        showsVerticalScrollIndicator={false}
      />
      {menuOpen && (
        <Pressable style={styles.menuBackdrop} onPress={closeMenu}>
          <Animated.View
            style={[
              styles.menu,
              {
                transform: [
                  {
                    translateY: menuSlide.interpolate({
                      inputRange: [0, 1],
                      outputRange: [260, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.menuTitle}>Main menu</Text>
            <View style={styles.menuGrid}>
              <Pressable
                accessibilityLabel="Home"
                accessibilityRole="button"
                style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
                onPress={goHome}
              >
                <Text style={styles.menuItemIcon}>⌂</Text>
                <Text style={styles.menuItemText}>Home</Text>
              </Pressable>
              <Pressable
                accessibilityLabel="Map"
                accessibilityRole="button"
                style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
                onPress={closeMenu}
              >
                <Text style={styles.menuItemIcon}>⌖</Text>
                <Text style={styles.menuItemText}>Map</Text>
              </Pressable>
              <Pressable
                accessibilityLabel="GPA"
                accessibilityRole="button"
                style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
                onPress={closeMenu}
              >
                <Text style={styles.menuItemIcon}>A+</Text>
                <Text style={styles.menuItemText}>GPA</Text>
              </Pressable>
              <Pressable
                accessibilityLabel="Scanner"
                accessibilityRole="button"
                style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
                onPress={closeMenu}
              >
                <Text style={styles.menuItemIcon}>▣</Text>
                <Text style={styles.menuItemText}>Scanner</Text>
              </Pressable>
              <Pressable
                accessibilityLabel="Settings"
                accessibilityRole="button"
                style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
                onPress={closeMenu}
              >
                <Text style={styles.menuItemIcon}>⚙</Text>
                <Text style={styles.menuItemText}>Settings</Text>
              </Pressable>
            </View>
          </Animated.View>
        </Pressable>
      )}
      <AnimatedPressable
        accessibilityLabel={menuOpen ? 'Close main menu' : 'Open main menu'}
        accessibilityRole="button"
        onPress={toggleMenu}
        style={[styles.centerButton, { transform: [buttonRotationStyle] }]}
      >
        <Image source={menuIcon} style={styles.centerButtonIcon} resizeMode="contain" />
      </AnimatedPressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#7ab2b9',
  },
  webView: {
    flex: 1,
  },
  centerButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#080808',
    borderRadius: 36,
    borderWidth: 3,
    bottom: '6%',
    elevation: 6,
    height: 68,
    justifyContent: 'center',
    left: '50%',
    marginLeft: -34,
    position: 'absolute',
    shadowColor: '#214497',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    width: 68,
  },
  centerButtonIcon: {
    height: 42,
    width: 42,
  },
  menuBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(12, 35, 64, 0.28)',
    justifyContent: 'flex-end',
    paddingBottom: 104,
    paddingHorizontal: 20,
  },
  menu: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    elevation: 8,
    padding: 18,
    shadowColor: '#153b75',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  menuTitle: {
    color: '#153b75',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  menuGrid: {
    flexWrap: 'wrap',
    flexDirection: 'row',
    gap: 12,
  },
  menuItem: {
    alignItems: 'center',
    backgroundColor: '#e9f6f5',
    borderColor: '#b9dedd',
    borderRadius: 14,
    borderWidth: 1,
    elevation: 2,
    flex: 1,
    minWidth: '22%',
    minHeight: 92,
    paddingHorizontal: 6,
    paddingVertical: 12,
    shadowColor: '#153b75',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
  },
  menuItemPressed: {
    backgroundColor: '#c8e9e7',
    borderColor: '#214497',
    opacity: 0.9,
  },
  menuItemIcon: {
    alignItems: 'center',
    color: '#153b75',
    fontSize: 28,
    fontWeight: '700',
    height: 38,
    lineHeight: 34,
    textAlign: 'center',
    width: 42,
  },
  menuItemText: {
    color: '#385675',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 6,
  },
});

export default App;
