import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import WebView from 'react-native-webview';

const menuIcon = require('./assets/centerButton_icon.png');
const defaultHomePageUrl = 'https://lms.lpec.lk/login/index.php';
const customHomePageStorageKey = 'customHomePageUrl';
const additionalLmsStorageKey = 'additionalLmsUrls';
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const getFaviconUrl = (url: string) =>
  `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(url)}&sz=64`;

function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [topMenuOpen, setTopMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<'main' | 'lms' | 'profile'>('main');
  const [homePageUrl, setHomePageUrl] = useState(defaultHomePageUrl);
  const [customHomePageUrl, setCustomHomePageUrl] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [additionalLmsUrls, setAdditionalLmsUrls] = useState<string[]>([]);
  const [additionalUrlInput, setAdditionalUrlInput] = useState('');
  const [urlToDelete, setUrlToDelete] = useState<string | null>(null);
  const [homePageKey, setHomePageKey] = useState(0);
  const menuSlideRef = useRef<Animated.Value | null>(null);
  const buttonRotationRef = useRef<Animated.Value | null>(null);

  useEffect(() => {
    const loadCustomHomePage = async () => {
      try {
        const savedUrl = await AsyncStorage.getItem(customHomePageStorageKey);

        if (savedUrl) {
          setCustomHomePageUrl(savedUrl);
          setHomePageUrl(savedUrl);
          setUrlInput(savedUrl);
        }

        const savedAdditionalUrls = await AsyncStorage.getItem(additionalLmsStorageKey);
        if (savedAdditionalUrls) {
          const parsedUrls: unknown = JSON.parse(savedAdditionalUrls);
          if (Array.isArray(parsedUrls)) {
            setAdditionalLmsUrls(parsedUrls.filter((url): url is string => typeof url === 'string'));
          }
        }
      } catch {}
    };

    loadCustomHomePage();
  }, []);

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
    setSettingsOpen(false);
  };

  const openSettings = () => {
    closeMenu();
    setTopMenuOpen(false);
    setSettingsOpen(true);
    setSettingsSection('main');
  };

  const openLmsSettings = () => setSettingsSection('lms');
  const openProfileSettings = () => setSettingsSection('profile');

  const submitUrl = async () => {
    const nextUrl = urlInput.trim();

    if (!nextUrl) {
      return;
    }

    setHomePageUrl(nextUrl);
    setCustomHomePageUrl(nextUrl);
    setHomePageKey(current => current + 1);
    try {
      await AsyncStorage.setItem(customHomePageStorageKey, nextUrl);
    } catch {}
  };

  const useCustomHomePage = () => {
    if (!customHomePageUrl) {
      return;
    }

    setHomePageUrl(customHomePageUrl);
    setHomePageKey(current => current + 1);
    setTopMenuOpen(false);
  };

  const useDefaultHomePage = () => {
    setHomePageUrl(defaultHomePageUrl);
    setHomePageKey(current => current + 1);
    setTopMenuOpen(false);
  };

  const selectAdditionalHomePage = (url: string) => {
    setHomePageUrl(url);
    setHomePageKey(current => current + 1);
    setTopMenuOpen(false);
  };

  const submitAdditionalUrl = async () => {
    const nextUrl = additionalUrlInput.trim();

    if (!nextUrl || additionalLmsUrls.includes(nextUrl)) {
      return;
    }

    const nextUrls = [...additionalLmsUrls, nextUrl];
    setAdditionalLmsUrls(nextUrls);
    setAdditionalUrlInput('');
    try {
      await AsyncStorage.setItem(additionalLmsStorageKey, JSON.stringify(nextUrls));
    } catch {}
  };

  const deleteAdditionalUrl = async () => {
    if (!urlToDelete) {
      return;
    }

    const nextUrls = additionalLmsUrls.filter(url => url !== urlToDelete);
    setAdditionalLmsUrls(nextUrls);
    setUrlToDelete(null);
    try {
      await AsyncStorage.setItem(additionalLmsStorageKey, JSON.stringify(nextUrls));
    } catch {}
  };

  const resetUrl = async () => {
    setUrlInput('');
    setHomePageUrl(defaultHomePageUrl);
    setCustomHomePageUrl(null);
    setHomePageKey(current => current + 1);
    setTopMenuOpen(false);
    try {
      await AsyncStorage.removeItem(customHomePageStorageKey);
    } catch {}
  };

  const buttonRotationStyle = {
    rotate: buttonRotation.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '180deg'],
    }),
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#153b75" barStyle="light-content" />
      {settingsOpen ? settingsSection === 'main' ? (
        <View style={styles.settingsScreen}>
          <View style={styles.settingsHeader}>
            <Pressable
              accessibilityLabel="Back to home"
              accessibilityRole="button"
              onPress={() => setSettingsOpen(false)}
              style={({ pressed }) => [styles.backButton, pressed && styles.menuItemPressed]}
            >
              <Text style={styles.backButtonText}>Back</Text>
            </Pressable>
            <Text style={styles.settingsTitle}>Settings</Text>
          </View>
          <Pressable
            accessibilityLabel="LMS settings"
            accessibilityRole="button"
            onPress={openLmsSettings}
            style={({ pressed }) => [styles.settingsOption, pressed && styles.menuItemPressed]}
          >
            <Text style={styles.settingsOptionTitle}>LMS</Text>
            <Text style={styles.settingsOptionText}>Homepage and additional LMS</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Profile settings"
            accessibilityRole="button"
            onPress={openProfileSettings}
            style={({ pressed }) => [styles.settingsOption, pressed && styles.menuItemPressed]}
          >
            <Text style={styles.settingsOptionTitle}>Profile</Text>
            <Text style={styles.settingsOptionText}>Manage your profile</Text>
          </Pressable>
        </View>
      ) : settingsSection === 'profile' ? (
        <View style={styles.settingsScreen}>
          <View style={styles.settingsHeader}>
            <Pressable
              accessibilityLabel="Back to settings"
              accessibilityRole="button"
              onPress={() => setSettingsSection('main')}
              style={({ pressed }) => [styles.backButton, pressed && styles.menuItemPressed]}
            >
              <Text style={styles.backButtonText}>Back</Text>
            </Pressable>
            <Text style={styles.settingsTitle}>Profile</Text>
          </View>
          <Text style={styles.profilePlaceholder}>Profile settings</Text>
        </View>
      ) : (
        <View style={styles.settingsScreen}>
          <View style={styles.settingsHeader}>
            <Pressable
              accessibilityLabel="Back to settings"
              accessibilityRole="button"
              onPress={() => setSettingsSection('main')}
              style={({ pressed }) => [styles.backButton, pressed && styles.menuItemPressed]}
            >
              <Text style={styles.backButtonText}>Back</Text>
            </Pressable>
            <Text style={styles.settingsTitle}>LMS</Text>
          </View>
          <Text style={styles.settingsLabel}>Home page URL</Text>
          <TextInput
            accessibilityLabel="Home page URL"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            onChangeText={setUrlInput}
            placeholder="https://example.com"
            style={styles.urlInput}
            value={urlInput}
          />
          <View style={styles.settingsActions}>
            <Pressable
              accessibilityRole="button"
              onPress={submitUrl}
              style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
            >
              <Text style={styles.actionButtonText}>Submit</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={resetUrl}
              style={({ pressed }) => [styles.defaultButton, pressed && styles.actionButtonPressed]}
            >
              <Text style={styles.defaultButtonText}>Default</Text>
            </Pressable>
          </View>
          <Text style={styles.settingsLabel}>Additional LMS</Text>
          <TextInput
            accessibilityLabel="Additional LMS URL"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            onChangeText={setAdditionalUrlInput}
            placeholder="https://additional-lms.example.com"
            style={styles.urlInput}
            value={additionalUrlInput}
          />
          <Pressable
            accessibilityRole="button"
            onPress={submitAdditionalUrl}
            style={({ pressed }) => [styles.actionButton, styles.additionalSubmitButton, pressed && styles.actionButtonPressed]}
          >
            <Text style={styles.actionButtonText}>Add LMS</Text>
          </Pressable>
          <View style={styles.additionalLmsList}>
            {additionalLmsUrls.map(url => (
              <View key={url} style={styles.additionalLmsRow}>
                <Text numberOfLines={2} style={styles.additionalLmsUrl}>{url}</Text>
                <Pressable
                  accessibilityLabel={`Delete ${url}`}
                  accessibilityRole="button"
                  onPress={() => setUrlToDelete(url)}
                  style={({ pressed }) => [styles.deleteButton, pressed && styles.actionButtonPressed]}
                >
                  <Text style={styles.deleteButtonText}>⌫</Text>
                </Pressable>
              </View>
            ))}
          </View>
        </View>
      ) : (
        <WebView
          key={homePageKey}
          originWhitelist={['*']}
          source={{ uri: homePageUrl }}
          style={styles.webView}
          showsVerticalScrollIndicator={false}
        />
      )}
      {!settingsOpen && (
        <View style={styles.topMenuContainer}>
          <Pressable
            accessibilityLabel={topMenuOpen ? 'Close LMS menu' : 'Open LMS menu'}
            accessibilityRole="button"
            onPress={() => setTopMenuOpen(current => !current)}
            style={({ pressed }) => [styles.topMenuButton, pressed && styles.topMenuButtonPressed]}
          >
            <Text style={styles.topMenuButtonIcon}>⋮</Text>
          </Pressable>
          {topMenuOpen && (
            <View style={styles.topMenu}>
              <Pressable
                accessibilityLabel="Use default LMS"
                accessibilityRole="button"
                onPress={useDefaultHomePage}
                style={({ pressed }) => [styles.topMenuItem, pressed && styles.topMenuItemPressed]}
              >
                <Image
                  accessibilityLabel="Default LMS favicon"
                  source={{ uri: getFaviconUrl(defaultHomePageUrl) }}
                  style={styles.topMenuItemIcon}
                />
              </Pressable>
              {customHomePageUrl && (
                <Pressable
                  accessibilityLabel="Use custom homepage"
                  accessibilityRole="button"
                  onPress={useCustomHomePage}
                  style={({ pressed }) => [styles.topMenuItem, pressed && styles.topMenuItemPressed]}
                >
                  <Image
                    accessibilityLabel="Custom LMS favicon"
                    source={{ uri: getFaviconUrl(customHomePageUrl) }}
                    style={styles.topMenuItemIcon}
                  />
                </Pressable>
              )}
              {additionalLmsUrls.map(url => (
                <Pressable
                  key={url}
                  accessibilityLabel={`Use ${url}`}
                  accessibilityRole="button"
                  onPress={() => selectAdditionalHomePage(url)}
                  style={({ pressed }) => [styles.topMenuItem, pressed && styles.topMenuItemPressed]}
                >
                  <Image
                    accessibilityLabel={`${url} favicon`}
                    source={{ uri: getFaviconUrl(url) }}
                    style={styles.topMenuItemIcon}
                  />
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}
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
                onPress={openSettings}
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
        <Image source={menuIcon} style={styles.centerButtonIcon} resizeMode="contain" tintColor="#153b75" />
      </AnimatedPressable>
      <Modal
        animationType="fade"
        transparent
        visible={urlToDelete !== null}
        onRequestClose={() => setUrlToDelete(null)}
      >
        <View style={styles.confirmationBackdrop}>
          <View style={styles.confirmationCard}>
            <Text style={styles.confirmationTitle}>Delete LMS?</Text>
            <Text numberOfLines={3} style={styles.confirmationText}>{urlToDelete}</Text>
            <View style={styles.confirmationActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setUrlToDelete(null)}
                style={({ pressed }) => [styles.cancelButton, pressed && styles.actionButtonPressed]}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={deleteAdditionalUrl}
                style={({ pressed }) => [styles.confirmButton, pressed && styles.actionButtonPressed]}
              >
                <Text style={styles.confirmButtonText}>OK</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#153b75',
  },
  webView: {
    flex: 1,
  },
  topMenuContainer: {
    position: 'absolute',
    right: 10,
    top: 65,
    zIndex: 2,
  },
  topMenuButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#153b75',
    borderRadius: 22,
    borderWidth: 1,
    elevation: 5,
    height: 44,
    justifyContent: 'center',
    shadowColor: '#153b75',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    width: 44,
  },
  topMenuButtonPressed: {
    backgroundColor: '#b9dedd',
  },
  topMenuButtonIcon: {
    color: '#153b75',
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 28,
  },
  topMenu: {
    backgroundColor: '#ffffff',
    borderColor: '#b9dedd',
    borderRadius: 12,
    borderWidth: 1,
    elevation: 8,
    marginTop: 8,
    minWidth: 60,
    overflow: 'hidden',
    paddingVertical: 4,
    position: 'absolute',
    right: 0,
    shadowColor: '#153b75',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    top: 44,
  },
  topMenuItem: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  topMenuItemPressed: {
    backgroundColor: '#b9dedd',
  },
  topMenuItemIcon: {
    height: 24,
    width: 24,
  },
  settingsScreen: {
    backgroundColor: '#ffffff',
    flex: 1,
    padding: 22,
  },
  settingsHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 34,
  },
  backButton: {
    backgroundColor: '#b9dedd',
    borderColor: '#b9dedd',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  backButtonText: {
    color: '#153b75',
    fontSize: 15,
    fontWeight: '600',
  },
  settingsTitle: {
    color: '#153b75',
    flex: 1,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  settingsOption: {
    backgroundColor: '#efffff',
    borderColor: '#b9dedd',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
    padding: 18,
  },
  settingsOptionTitle: {
    color: '#153b75',
    fontSize: 18,
    fontWeight: '700',
  },
  settingsOptionText: {
    color: '#153b75',
    fontSize: 14,
    marginTop: 6,
  },
  profilePlaceholder: {
    color: '#153b75',
    fontSize: 16,
  },
  settingsLabel: {
    color: '#153b75',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  urlInput: {
    backgroundColor: '#ffffff',
    borderColor: '#b9dedd',
    borderRadius: 10,
    borderWidth: 1,
    color: '#153b75',
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  settingsActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  additionalSubmitButton: {
    alignSelf: 'flex-start',
    flex: 0,
    marginTop: 12,
    paddingHorizontal: 24,
  },
  additionalLmsList: {
    gap: 10,
    marginTop: 18,
  },
  additionalLmsRow: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#b9dedd',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    paddingLeft: 14,
  },
  additionalLmsUrl: {
    color: '#153b75',
    flex: 1,
    fontSize: 15,
    paddingVertical: 12,
  },
  deleteButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 48,
  },
  deleteButtonText: {
    color: '#b42318',
    fontSize: 23,
    fontWeight: '700',
  },
  actionButton: {
    alignItems: 'center',
    backgroundColor: '#153b75',
    borderRadius: 10,
    flex: 1,
    paddingVertical: 13,
  },
  actionButtonPressed: {
    opacity: 0.8,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  defaultButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#153b75',
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 13,
  },
  defaultButtonText: {
    color: '#153b75',
    fontSize: 15,
    fontWeight: '700',
  },
  confirmationBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(21, 59, 117, 0.35)',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  confirmationCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    elevation: 8,
    maxWidth: 360,
    padding: 22,
    shadowColor: '#153b75',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    width: '100%',
  },
  confirmationTitle: {
    color: '#153b75',
    fontSize: 20,
    fontWeight: '700',
  },
  confirmationText: {
    color: '#153b75',
    fontSize: 15,
    marginTop: 10,
  },
  confirmationActions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
    marginTop: 22,
  },
  cancelButton: {
    alignItems: 'center',
    borderColor: '#153b75',
    borderRadius: 9,
    borderWidth: 1,
    minWidth: 90,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  cancelButtonText: {
    color: '#153b75',
    fontSize: 15,
    fontWeight: '700',
  },
  confirmButton: {
    alignItems: 'center',
    backgroundColor: '#b42318',
    borderRadius: 9,
    minWidth: 76,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  confirmButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  centerButton: {
    alignItems: 'center',
    backgroundColor: '#efffff',
    borderColor: '#153b75',
    borderRadius: 36,
    borderWidth: 3,
    bottom: '6%',
    elevation: 6,
    height: 68,
    justifyContent: 'center',
    left: '50%',
    marginLeft: -34,
    position: 'absolute',
    shadowColor: '#153b75',
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
    backgroundColor: 'rgba(21, 59, 117, 0.28)',
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
    backgroundColor: '#efffff',
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
    backgroundColor: '#ffffff',
    borderColor: '#b9dedd',
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
    color: '#153b75',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 6,
  },
});

export default App;
