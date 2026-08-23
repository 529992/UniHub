import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ComponentRef } from 'react';
import {
  Animated,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import WebView from 'react-native-webview';

const menuIcon = require('./assets/centerButton_icon.png');
const defaultHomePageUrl = 'https://lms.lpec.lk/login/index.php';
const universityOptions = [
  'University of Colombo',
  'University of Peradeniya',
  'University of Sri Jayewardenepura',
  'University of Kelaniya',
  'University of Moratuwa',
  'University of Jaffna',
  'University of Ruhuna',
  'Eastern University, Sri Lanka',
  'South Eastern University of Sri Lanka',
  'Rajarata University of Sri Lanka',
  'Sabaragamuwa University of Sri Lanka',
  'Wayamba University of Sri Lanka',
  'Uva Wellassa University',
  'University of the Visual & Performing Arts',
  'The Open University of Sri Lanka',
  'Gampaha Wickramarachchi University of Indigenous Medicine',
  'University of Vavuniya',
];
type MapPlace = {
  display_name: string;
  lat: string;
  lon: string;
  name?: string;
};
type Subject = {
  id: string;
  name: string;
  grade: string;
  credit: string;
};
const gradePoints: Record<string, number> = {
  A: 4,
  'A-': 3.7,
  'B+': 3.3,
  B: 3,
  'B-': 2.7,
  'C+': 2.3,
  C: 2,
  'C-': 1.7,
  'D+': 1.3,
  D: 1,
  E: 0,
  F: 0,
};

const calculateGpa = (semesterSubjects: Subject[]) => {
  const totals = semesterSubjects.reduce(
    (result, subject) => {
      const credit = Number(subject.credit);
      const gradePoint = gradePoints[subject.grade];
      if (!Number.isFinite(credit) || credit <= 0 || gradePoint === undefined) {
        return result;
      }
      return {
        credits: result.credits + credit,
        qualityPoints: result.qualityPoints + gradePoint * credit,
      };
    },
    { credits: 0, qualityPoints: 0 },
  );

  return {
    credits: totals.credits,
    gpa: totals.credits > 0 ? totals.qualityPoints / totals.credits : null,
  };
};
const openFreeMapHtml = `
<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <link href="https://unpkg.com/maplibre-gl@5.6.1/dist/maplibre-gl.css" rel="stylesheet" />
    <script src="https://unpkg.com/maplibre-gl@5.6.1/dist/maplibre-gl.js"></script>
    <style>
      html, body, #map { width: 100%; height: 100%; margin: 0; }
      body { overflow: hidden; }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script>
      const map = new maplibregl.Map({
        container: 'map',
        style: 'https://tiles.openfreemap.org/styles/liberty',
        center: [80.7718, 7.8731],
        zoom: 7,
        attributionControl: true
      });
      const governmentUniversities = [
        { name: 'University of Colombo', city: 'Colombo', coordinates: [79.8612, 6.9004] },
        { name: 'University of Peradeniya', city: 'Peradeniya', coordinates: [80.5978, 7.2547] },
        { name: 'University of Sri Jayewardenepura', city: 'Nugegoda', coordinates: [79.9047, 6.8528] },
        { name: 'University of Kelaniya', city: 'Kelaniya', coordinates: [79.9150, 6.9747] },
        { name: 'University of Moratuwa', city: 'Moratuwa', coordinates: [79.9000, 6.7951] },
        { name: 'University of Jaffna', city: 'Jaffna', coordinates: [80.0180, 9.6850] },
        { name: 'University of Ruhuna', city: 'Matara', coordinates: [80.5550, 5.9550] },
        { name: 'Eastern University, Sri Lanka', city: 'Chenkalady', coordinates: [81.5710, 7.7940] },
        { name: 'South Eastern University of Sri Lanka', city: 'Oluvil', coordinates: [81.8420, 7.2930] },
        { name: 'Rajarata University of Sri Lanka', city: 'Mihintale', coordinates: [80.5030, 8.3510] },
        { name: 'Sabaragamuwa University of Sri Lanka', city: 'Belihuloya', coordinates: [80.7890, 6.7160] },
        { name: 'Wayamba University of Sri Lanka', city: 'Kuliyapitiya', coordinates: [80.0222038, 7.4625961] },
        { name: 'Uva Wellassa University', city: 'Badulla', coordinates: [81.0560, 6.9840] },
        { name: 'University of the Visual & Performing Arts', city: 'Colombo', coordinates: [79.8600, 6.9020] },
        { name: 'The Open University of Sri Lanka', city: 'Nugegoda', coordinates: [79.8840, 6.8830] },
        { name: 'Gampaha Wickramarachchi University of Indigenous Medicine', city: 'Yakkala', coordinates: [80.0140, 7.1110] },
        { name: 'University of Vavuniya', city: 'Vavuniya', coordinates: [80.4980, 8.7530] }
      ];
      const universityMarkers = [];
      governmentUniversities.forEach(university => {
        const marker = new maplibregl.Marker({ color: '#16803c' })
          .setLngLat(university.coordinates)
          .setPopup(new maplibregl.Popup({ offset: 25 }).setHTML(
            '<strong>' + university.name + '</strong><br>' + university.city
          ))
          .addTo(map);
        universityMarkers.push({ marker, name: university.name });
      });
      let searchMarker;
      window.addEventListener('message', event => {
        const place = JSON.parse(event.data);
        if (place.type === 'set-universities') {
          universityMarkers.forEach(universityMarker => {
            const shouldShow = place.visible && (
              place.mode === 'all' || universityMarker.name === place.selectedUniversity
            );
            universityMarker.marker.getElement().style.display = shouldShow ? '' : 'none';
          });
          return;
        }
        map.flyTo({ center: [place.longitude, place.latitude], zoom: 15 });
        if (searchMarker) searchMarker.remove();
        searchMarker = new maplibregl.Marker({ color: '#b42318' })
          .setLngLat([place.longitude, place.latitude])
          .addTo(map);
      });
    </script>
  </body>
</html>`;
const customHomePageStorageKey = 'customHomePageUrl';
const additionalLmsStorageKey = 'additionalLmsUrls';
const selectedUniversityStorageKey = 'selectedUniversity';
const universityMarkerModeStorageKey = 'universityMarkerMode';
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const getFaviconUrl = (url: string) =>
  `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(url)}&sz=64`;

const getNextSemesterName = (semesters: string[]) => {
  const semesterNumbers = semesters.reduce<number[]>((numbers, semester) => {
    const match = semester.match(/^Semester (\d+)$/);
    return match ? [...numbers, Number(match[1])] : numbers;
  }, []);
  const nextNumber = semesterNumbers.length > 0 ? Math.max(...semesterNumbers) + 1 : 1;
  return `Semester ${String(nextNumber).padStart(2, '0')}`;
};

function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeScreen, setActiveScreen] = useState<'home' | 'map' | 'gpa'>('home');
  const [topMenuOpen, setTopMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<'main' | 'lms' | 'profile' | 'map'>('main');
  const [homePageUrl, setHomePageUrl] = useState(defaultHomePageUrl);
  const [customHomePageUrl, setCustomHomePageUrl] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [additionalLmsUrls, setAdditionalLmsUrls] = useState<string[]>([]);
  const [additionalUrlInput, setAdditionalUrlInput] = useState('');
  const [urlToDelete, setUrlToDelete] = useState<string | null>(null);
  const [mapSearchQuery, setMapSearchQuery] = useState('');
  const [mapSearchResults, setMapSearchResults] = useState<MapPlace[]>([]);
  const [mapSearchLoading, setMapSearchLoading] = useState(false);
  const [showUniversityMarkers, setShowUniversityMarkers] = useState(true);
  const [universityMarkerMode, setUniversityMarkerMode] = useState<'all' | 'selected'>('all');
  const [selectedUniversity, setSelectedUniversity] = useState('');
  const [universityPickerOpen, setUniversityPickerOpen] = useState(false);
  const [institutions, setInstitutions] = useState<Record<string, string[]>>({});
  const [institutionNameInput, setInstitutionNameInput] = useState('');
  const [semesterNameInput, setSemesterNameInput] = useState('');
  const [addInstitutionOpen, setAddInstitutionOpen] = useState(false);
  const [selectedInstitution, setSelectedInstitution] = useState<string | null>(null);
  const [selectedSemester, setSelectedSemester] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<Record<string, Subject[]>>({});
  const [subjectFormOpen, setSubjectFormOpen] = useState(false);
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [subjectNameInput, setSubjectNameInput] = useState('');
  const [subjectGradeInput, setSubjectGradeInput] = useState('A');
  const [subjectCreditInput, setSubjectCreditInput] = useState('');
  const [gradePickerOpen, setGradePickerOpen] = useState(false);
  const [subjectToDelete, setSubjectToDelete] = useState<Subject | null>(null);
  const [institutionToDelete, setInstitutionToDelete] = useState<string | null>(null);
  const [semesterToDelete, setSemesterToDelete] = useState<string | null>(null);
  const [homePageKey, setHomePageKey] = useState(0);
  const mapWebViewRef = useRef<ComponentRef<typeof WebView>>(null);
  const skipMapSuggestionsRef = useRef(false);
  const mapSearchRequestRef = useRef(0);
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

        const savedUniversity = await AsyncStorage.getItem(selectedUniversityStorageKey);
        if (savedUniversity && universityOptions.includes(savedUniversity)) {
          setSelectedUniversity(savedUniversity);
        }

        const savedMarkerMode = await AsyncStorage.getItem(universityMarkerModeStorageKey);
        if (savedMarkerMode === 'all' || savedMarkerMode === 'selected') {
          setUniversityMarkerMode(savedMarkerMode);
        }
      } catch {}
    };

    loadCustomHomePage();
  }, []);

  useEffect(() => {
    if (skipMapSuggestionsRef.current) {
      skipMapSuggestionsRef.current = false;
      return;
    }

    const query = mapSearchQuery.trim();
    if (query.length < 2) {
      setMapSearchResults([]);
      setMapSearchLoading(false);
      return;
    }

    const requestId = mapSearchRequestRef.current + 1;
    mapSearchRequestRef.current = requestId;
    const timeoutId = setTimeout(async () => {
      setMapSearchLoading(true);
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=lk&dedupe=1&limit=5&q=${encodeURIComponent(query)}`,
          { headers: { Accept: 'application/json', 'User-Agent': 'UniHub/1.0' } },
        );
        if (!response.ok) {
          throw new Error(`Map search failed with status ${response.status}`);
        }
        const places: unknown = await response.json();
        if (requestId === mapSearchRequestRef.current) {
          setMapSearchResults(Array.isArray(places) ? places : []);
        }
      } catch {
        if (requestId === mapSearchRequestRef.current) {
          setMapSearchResults([]);
        }
      } finally {
        if (requestId === mapSearchRequestRef.current) {
          setMapSearchLoading(false);
        }
      }
    }, 350);

    return () => clearTimeout(timeoutId);
  }, [mapSearchQuery]);

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
    setActiveScreen('home');
    setHomePageKey(current => current + 1);
    closeMenu();
    setSettingsOpen(false);
  };

  const openMap = () => {
    setActiveScreen('map');
    closeMenu();
    setSettingsOpen(false);
    setTopMenuOpen(false);
  };

  const openGpa = () => {
    setActiveScreen('gpa');
    closeMenu();
    setSettingsOpen(false);
    setTopMenuOpen(false);
  };

  const openSettings = () => {
    closeMenu();
    setTopMenuOpen(false);
    setSettingsOpen(true);
    setSettingsSection('main');
  };

  const openLmsSettings = () => setSettingsSection('lms');
  const openProfileSettings = () => setSettingsSection('profile');
  const openMapSettings = () => setSettingsSection('map');

  const applyUniversityMarkerSetting = useCallback(() => {
    mapWebViewRef.current?.injectJavaScript(`window.postMessage(${JSON.stringify(JSON.stringify({
      type: 'set-universities',
      visible: showUniversityMarkers,
      mode: universityMarkerMode,
      selectedUniversity,
    }))}, '*'); true;`);
  }, [selectedUniversity, showUniversityMarkers, universityMarkerMode]);

  const toggleUniversityMarkers = (visible: boolean) => {
    setShowUniversityMarkers(visible);
  };

  const changeUniversityMarkerMode = async (mode: 'all' | 'selected') => {
    setUniversityMarkerMode(mode);
    try {
      await AsyncStorage.setItem(universityMarkerModeStorageKey, mode);
    } catch {}
  };

  useEffect(() => {
    applyUniversityMarkerSetting();
  }, [applyUniversityMarkerSetting]);

  const submitUniversity = async () => {
    if (!selectedUniversity) {
      return;
    }

    try {
      await AsyncStorage.setItem(selectedUniversityStorageKey, selectedUniversity);
    } catch {}
  };

  const deleteUniversity = async () => {
    setSelectedUniversity('');
    setUniversityPickerOpen(false);
    try {
      await AsyncStorage.removeItem(selectedUniversityStorageKey);
    } catch {}
  };

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

  const submitInstitution = () => {
    const institutionName = institutionNameInput.trim();

    if (!institutionName || institutions[institutionName]) {
      return;
    }

    setInstitutions(current => ({ ...current, [institutionName]: [] }));
    setInstitutionNameInput('');
    setAddInstitutionOpen(false);
  };

  const submitSemester = () => {
    const semesterName = semesterNameInput.trim();

    if (!selectedInstitution || !semesterName) {
      return;
    }

    setInstitutions(current => ({
      ...current,
      [selectedInstitution]: [...(current[selectedInstitution] || []), semesterName],
    }));
    setSemesterNameInput(getNextSemesterName([...(institutions[selectedInstitution] || []), semesterName]));
  };

  const deleteInstitution = () => {
    if (!institutionToDelete) {
      return;
    }

    setInstitutions(current => {
      const nextInstitutions = { ...current };
      delete nextInstitutions[institutionToDelete];
      return nextInstitutions;
    });
    setInstitutionToDelete(null);
    setSelectedInstitution(null);
  };

  const deleteSemester = () => {
    if (!selectedInstitution || !semesterToDelete) {
      return;
    }

    const remainingSemesters = (institutions[selectedInstitution] || []).filter(
      semesterName => semesterName !== semesterToDelete,
    );
    setInstitutions(current => ({
      ...current,
      [selectedInstitution]: remainingSemesters,
    }));
    setSemesterNameInput(getNextSemesterName(remainingSemesters));
    setSemesterToDelete(null);
  };

  const getSemesterKey = (semesterName: string) => `${selectedInstitution}::${semesterName}`;

  const openAddSubject = () => {
    setEditingSubjectId(null);
    setSubjectNameInput('');
    setSubjectGradeInput('A');
    setSubjectCreditInput('');
    setGradePickerOpen(false);
    setSubjectFormOpen(true);
  };

  const openEditSubject = (subject: Subject) => {
    setEditingSubjectId(subject.id);
    setSubjectNameInput(subject.name);
    setSubjectGradeInput(subject.grade);
    setSubjectCreditInput(subject.credit);
    setGradePickerOpen(false);
    setSubjectFormOpen(true);
  };

  const submitSubject = () => {
    if (!selectedSemester || !subjectNameInput.trim() || !subjectCreditInput.trim()) {
      return;
    }

    const semesterKey = getSemesterKey(selectedSemester);
    const subject = {
      id: editingSubjectId || `${Date.now()}`,
      name: subjectNameInput.trim(),
      grade: subjectGradeInput,
      credit: subjectCreditInput.trim(),
    };
    setSubjects(current => ({
      ...current,
      [semesterKey]: editingSubjectId
        ? (current[semesterKey] || []).map(item => item.id === editingSubjectId ? subject : item)
        : [...(current[semesterKey] || []), subject],
    }));
    setSubjectFormOpen(false);
  };

  const deleteSubject = () => {
    if (!selectedSemester || !subjectToDelete) {
      return;
    }

    const semesterKey = getSemesterKey(selectedSemester);
    setSubjects(current => ({
      ...current,
      [semesterKey]: (current[semesterKey] || []).filter(subject => subject.id !== subjectToDelete.id),
    }));
    setSubjectToDelete(null);
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

  const submitMapSearch = async () => {
    const query = mapSearchQuery.trim();

    if (!query) {
      setMapSearchResults([]);
      return;
    }

    setMapSearchLoading(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=lk&limit=5&q=${encodeURIComponent(query)}`,
        { headers: { Accept: 'application/json', 'User-Agent': 'UniHub/1.0' } },
      );
      if (!response.ok) {
        throw new Error(`Map search failed with status ${response.status}`);
      }
      const places: unknown = await response.json();
      setMapSearchResults(Array.isArray(places) ? places : []);
    } catch {
      setMapSearchResults([]);
    } finally {
      setMapSearchLoading(false);
    }
  };

  const selectMapPlace = (place: MapPlace) => {
    skipMapSuggestionsRef.current = true;
    setMapSearchQuery(place.name || place.display_name.split(',')[0]);
    setMapSearchResults([]);
    mapWebViewRef.current?.injectJavaScript(`window.postMessage(${JSON.stringify(JSON.stringify({
      latitude: Number(place.lat),
      longitude: Number(place.lon),
    }))}, '*'); true;`);
  };

  const buttonRotationStyle = {
    rotate: buttonRotation.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '180deg'],
    }),
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
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
            accessibilityLabel="Map settings"
            accessibilityRole="button"
            onPress={openMapSettings}
            style={({ pressed }) => [styles.settingsOption, pressed && styles.menuItemPressed]}
          >
            <Text style={styles.settingsOptionTitle}>Map</Text>
            <Text style={styles.settingsOptionText}>Change map settings</Text>
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
      ) : settingsSection === 'map' ? (
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
            <Text style={styles.settingsTitle}>Map</Text>
          </View>
          <Text style={styles.settingsLabel}>University</Text>
          <Pressable
            accessibilityLabel="Select university"
            accessibilityRole="button"
            onPress={() => setUniversityPickerOpen(open => !open)}
            style={({ pressed }) => [styles.universitySelector, pressed && styles.actionButtonPressed]}
          >
            <Text style={selectedUniversity ? styles.universitySelectorText : styles.universityPlaceholder}>
              {selectedUniversity || 'Select a university'}
            </Text>
            <Text style={styles.universitySelectorArrow}>{universityPickerOpen ? '▲' : '▼'}</Text>
          </Pressable>
          {universityPickerOpen && (
            <ScrollView style={styles.universityOptions} nestedScrollEnabled>
              {universityOptions.map(university => (
                <Pressable
                  accessibilityLabel={university}
                  accessibilityRole="button"
                  key={university}
                  onPress={() => {
                    setSelectedUniversity(university);
                    setUniversityPickerOpen(false);
                  }}
                  style={({ pressed }) => [styles.universityOption, pressed && styles.mapSearchResultPressed]}
                >
                  <Text style={styles.universityOptionText}>{university}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
          <View style={styles.settingsActions}>
            <Pressable
              accessibilityRole="button"
              onPress={submitUniversity}
              style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
            >
              <Text style={styles.actionButtonText}>Submit</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={deleteUniversity}
              style={({ pressed }) => [styles.defaultButton, pressed && styles.actionButtonPressed]}
            >
              <Text style={styles.defaultButtonText}>Delete</Text>
            </Pressable>
          </View>
          <View style={styles.mapSettingRow}>
            <View style={styles.mapSettingText}>
              <Text style={styles.settingsOptionTitle}>University markers</Text>
              <Text style={styles.settingsOptionText}>Show government universities on the map</Text>
            </View>
            <Switch
              accessibilityLabel="Show university markers"
              onValueChange={toggleUniversityMarkers}
              thumbColor={showUniversityMarkers ? '#ffffff' : '#6d7b8b'}
              trackColor={{ false: '#d5dddd', true: '#2b639c' }}
              value={showUniversityMarkers}
            />
          </View>
          {showUniversityMarkers && (
            <View style={styles.universityMarkerOptions}>
              <Pressable
                accessibilityLabel="All universities"
                accessibilityRole="radio"
                accessibilityState={{ selected: universityMarkerMode === 'all' }}
                onPress={() => changeUniversityMarkerMode('all')}
                style={({ pressed }) => [styles.universityMarkerOption, pressed && styles.actionButtonPressed]}
              >
                <View style={styles.universityMarkerRadio}>
                  {universityMarkerMode === 'all' && <View style={styles.universityMarkerRadioSelected} />}
                </View>
                <Text style={styles.universityMarkerOptionText}>All universities</Text>
              </Pressable>
              <Pressable
                accessibilityLabel="Your university"
                accessibilityRole="radio"
                accessibilityState={{
                  disabled: !selectedUniversity,
                  selected: universityMarkerMode === 'selected',
                }}
                disabled={!selectedUniversity}
                onPress={() => changeUniversityMarkerMode('selected')}
                style={({ pressed }) => [
                  styles.universityMarkerOption,
                  !selectedUniversity && styles.universityMarkerOptionDisabled,
                  pressed && styles.actionButtonPressed,
                ]}
              >
                <View style={styles.universityMarkerRadio}>
                  {universityMarkerMode === 'selected' && <View style={styles.universityMarkerRadioSelected} />}
                </View>
                <Text style={styles.universityMarkerOptionText}>Your university</Text>
              </Pressable>
            </View>
          )}
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
      ) : activeScreen === 'gpa' ? selectedInstitution && selectedSemester ? (
        <View style={styles.gpaScreen}>
          <View style={styles.gpaHeader}>
            <Pressable
              accessibilityLabel="Back to semesters"
              accessibilityRole="button"
              onPress={() => setSelectedSemester(null)}
              style={({ pressed }) => [styles.backButton, pressed && styles.menuItemPressed]}
            >
              <Text style={styles.backButtonText}>Back</Text>
            </Pressable>
            <Text numberOfLines={1} style={styles.gpaTitle}>{selectedSemester}</Text>
            <Pressable
              accessibilityLabel="Add subject"
              accessibilityRole="button"
              onPress={openAddSubject}
              style={({ pressed }) => [styles.actionButton, styles.addSubjectButton, pressed && styles.actionButtonPressed]}
            >
              <Text style={styles.actionButtonText}>Add subject</Text>
            </Pressable>
          </View>
            {(() => {
              const semesterSubjects = subjects[getSemesterKey(selectedSemester)] || [];
              const { credits, gpa } = calculateGpa(semesterSubjects);
              return (
                <>
                  <View style={styles.gpaSummary}>
                    <View>
                      <Text style={styles.gpaSummaryLabel}>Semester GPA</Text>
                      <Text accessibilityLabel="Semester GPA" style={styles.gpaSummaryValue}>
                        {gpa === null ? '--' : gpa.toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.gpaCreditsSummary}>
                      <Text style={styles.gpaSummaryLabel}>Total credits</Text>
                      <Text accessibilityLabel="Total credits" style={styles.gpaCreditsValue}>
                        {credits}
                      </Text>
                    </View>
                  </View>
                  <ScrollView contentContainerStyle={styles.gpaClassList}>
                    {semesterSubjects.map(subject => (
              <View key={subject.id} style={styles.subjectCard}>
                <View style={styles.subjectDetails}>
                  <Text style={styles.gpaClassName}>{subject.name}</Text>
                  <Text style={styles.subjectMeta}>Grade {subject.grade}  |  {subject.credit} credits</Text>
                </View>
                <Pressable
                  accessibilityLabel={`Edit ${subject.name}`}
                  accessibilityRole="button"
                  onPress={() => openEditSubject(subject)}
                  style={({ pressed }) => [styles.editButton, pressed && styles.actionButtonPressed]}
                >
                  <Text style={styles.editButtonText}>Edit</Text>
                </Pressable>
                <Pressable
                  accessibilityLabel={`Delete ${subject.name}`}
                  accessibilityRole="button"
                  onPress={() => setSubjectToDelete(subject)}
                  style={({ pressed }) => [styles.deleteButton, pressed && styles.actionButtonPressed]}
                >
                  <Text style={styles.deleteButtonText}>⌫</Text>
                </Pressable>
              </View>
                  ))}
                </ScrollView>
              </>
            );
          })()}
        </View>
      ) : selectedInstitution ? (
        <View style={styles.gpaScreen}>
          <View style={styles.gpaHeader}>
            <Pressable
              accessibilityLabel="Back to GPA institutions"
              accessibilityRole="button"
              onPress={() => setSelectedInstitution(null)}
              style={({ pressed }) => [styles.backButton, pressed && styles.menuItemPressed]}
            >
              <Text style={styles.backButtonText}>Back</Text>
            </Pressable>
            <Text numberOfLines={1} style={styles.gpaTitle}>{selectedInstitution}</Text>
            <Pressable
              accessibilityLabel={`Delete institution ${selectedInstitution}`}
              accessibilityRole="button"
              onPress={() => setInstitutionToDelete(selectedInstitution)}
              style={({ pressed }) => [styles.deleteButton, pressed && styles.actionButtonPressed]}
            >
              <Text style={styles.deleteButtonText}>⌫</Text>
            </Pressable>
          </View>
          <Text style={styles.settingsLabel}>Add semester</Text>
          <View style={styles.semesterFormRow}>
            <TextInput
              accessibilityLabel="Semester name"
              onChangeText={setSemesterNameInput}
              onSubmitEditing={submitSemester}
              placeholder="Semester name"
              placeholderTextColor="#6d7b8b"
              returnKeyType="done"
              style={[styles.urlInput, styles.semesterInput]}
              value={semesterNameInput}
            />
            <Pressable
              accessibilityLabel="Add semester"
              accessibilityRole="button"
              onPress={submitSemester}
              style={({ pressed }) => [styles.actionButton, styles.semesterSubmitButton, pressed && styles.actionButtonPressed]}
            >
              <Text style={styles.actionButtonText}>Add</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.gpaClassList}>
            {(institutions[selectedInstitution] || []).map((semesterName, index) => (
              <View key={`${semesterName}-${index}`} style={styles.gpaClassCard}>
                <Pressable
                  accessibilityLabel={`Open ${semesterName}`}
                  accessibilityRole="button"
                  onPress={() => setSelectedSemester(semesterName)}
                  style={styles.semesterCardButton}
                >
                  <Text style={styles.gpaClassName}>{semesterName}</Text>
                  <Text style={styles.institutionArrow}>›</Text>
                </Pressable>
                <Pressable
                  accessibilityLabel={`Delete ${semesterName}`}
                  accessibilityRole="button"
                  onPress={() => setSemesterToDelete(semesterName)}
                  style={({ pressed }) => [styles.deleteButton, pressed && styles.actionButtonPressed]}
                >
                  <Text style={styles.deleteButtonText}>⌫</Text>
                </Pressable>
              </View>
            ))}
          </ScrollView>
        </View>
      ) : (
        <View style={styles.gpaScreen}>
          <View style={styles.gpaHeader}>
            <Text style={styles.gpaTitle}>GPA</Text>
            <Pressable
              accessibilityLabel="Add institution"
              accessibilityRole="button"
              onPress={() => setAddInstitutionOpen(true)}
              style={({ pressed }) => [styles.actionButton, styles.addClassButton, pressed && styles.actionButtonPressed]}
            >
              <Text style={styles.actionButtonText}>Add institution</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.gpaClassList}>
            {Object.keys(institutions).map(institutionName => (
              <Pressable
                accessibilityLabel={`Open ${institutionName}`}
                accessibilityRole="button"
                key={institutionName}
                onPress={() => {
                  setSelectedInstitution(institutionName);
                  setSelectedSemester(null);
                  setSemesterNameInput(getNextSemesterName(institutions[institutionName] || []));
                }}
                style={({ pressed }) => [styles.gpaClassCard, pressed && styles.actionButtonPressed]}
              >
                <Text style={styles.gpaClassName}>{institutionName}</Text>
                <Text style={styles.institutionArrow}>›</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : activeScreen === 'map' ? (
        <View style={styles.mapScreen}>
          <WebView
            originWhitelist={['*']}
            ref={mapWebViewRef}
            source={{ html: openFreeMapHtml }}
            style={styles.webView}
            onLoadEnd={applyUniversityMarkerSetting}
            javaScriptEnabled
            domStorageEnabled
            showsVerticalScrollIndicator={false}
          />
          <View style={styles.mapSearchContainer}>
            <TextInput
              accessibilityLabel="Search map"
              autoCapitalize="words"
              autoCorrect={false}
              onChangeText={setMapSearchQuery}
              onSubmitEditing={submitMapSearch}
              placeholder="Search map"
              placeholderTextColor="#6d7b8b"
              returnKeyType="search"
              style={styles.mapSearchInput}
              value={mapSearchQuery}
            />
            <Pressable
              accessibilityLabel="Search map"
              accessibilityRole="button"
              onPress={submitMapSearch}
              style={({ pressed }) => [styles.mapSearchButton, pressed && styles.mapSearchButtonPressed]}
            >
              <Text style={styles.mapSearchButtonText}>Search</Text>
            </Pressable>
          </View>
          {(mapSearchLoading || mapSearchResults.length > 0) && (
            <View style={styles.mapSearchResults}>
              {mapSearchLoading ? (
                <Text style={styles.mapSearchStatus}>Searching...</Text>
              ) : mapSearchResults.map(place => (
                <Pressable
                  accessibilityLabel={`Show ${place.name || place.display_name}`}
                  accessibilityRole="button"
                  key={`${place.lat}-${place.lon}-${place.display_name}`}
                  onPress={() => selectMapPlace(place)}
                  style={({ pressed }) => [styles.mapSearchResult, pressed && styles.mapSearchResultPressed]}
                >
                  <Text numberOfLines={1} style={styles.mapSearchResultTitle}>
                    {place.name || place.display_name.split(',')[0]}
                  </Text>
                  <Text numberOfLines={2} style={styles.mapSearchResultText}>{place.display_name}</Text>
                </Pressable>
              ))}
            </View>
          )}
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
      {!settingsOpen && activeScreen === 'home' && (
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
                onPress={openMap}
              >
                <Text style={styles.menuItemIcon}>⌖</Text>
                <Text style={styles.menuItemText}>Map</Text>
              </Pressable>
              <Pressable
                accessibilityLabel="GPA"
                accessibilityRole="button"
                style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
                onPress={openGpa}
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
        visible={subjectFormOpen}
        onRequestClose={() => setSubjectFormOpen(false)}
      >
        <View style={styles.confirmationBackdrop}>
          <View style={styles.confirmationCard}>
            <Text style={styles.confirmationTitle}>{editingSubjectId ? 'Edit subject' : 'Add subject'}</Text>
            <TextInput
              accessibilityLabel="Subject name"
              autoFocus
              onChangeText={setSubjectNameInput}
              placeholder="Subject name"
              placeholderTextColor="#6d7b8b"
              style={styles.urlInput}
              value={subjectNameInput}
            />
            <Pressable
              accessibilityLabel="Grade"
              accessibilityRole="button"
              onPress={() => setGradePickerOpen(open => !open)}
              style={styles.universitySelector}
            >
              <Text style={styles.universitySelectorText}>Grade: {subjectGradeInput}</Text>
              <Text style={styles.universitySelectorArrow}>{gradePickerOpen ? '▲' : '▼'}</Text>
            </Pressable>
            {gradePickerOpen && (
              <View style={styles.gradeOptions}>
                {['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'E'].map(grade => (
                  <Pressable
                    accessibilityLabel={`Grade ${grade}`}
                    accessibilityRole="button"
                    key={grade}
                    onPress={() => { setSubjectGradeInput(grade); setGradePickerOpen(false); }}
                    style={styles.gradeOption}
                  >
                    <Text style={styles.universityOptionText}>{grade}</Text>
                  </Pressable>
                ))}
              </View>
            )}
            <TextInput
              accessibilityLabel="Credit"
              keyboardType="decimal-pad"
              onChangeText={setSubjectCreditInput}
              placeholder="Credit"
              placeholderTextColor="#6d7b8b"
              style={styles.urlInput}
              value={subjectCreditInput}
            />
            <View style={styles.confirmationActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setSubjectFormOpen(false)}
                style={({ pressed }) => [styles.cancelButton, pressed && styles.actionButtonPressed]}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={submitSubject}
                style={({ pressed }) => [styles.confirmButton, pressed && styles.actionButtonPressed]}
              >
                <Text style={styles.confirmButtonText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        animationType="fade"
        transparent
        visible={subjectToDelete !== null}
        onRequestClose={() => setSubjectToDelete(null)}
      >
        <View style={styles.confirmationBackdrop}>
          <View style={styles.confirmationCard}>
            <Text style={styles.confirmationTitle}>Delete subject?</Text>
            <Text numberOfLines={3} style={styles.confirmationText}>{subjectToDelete?.name}</Text>
            <View style={styles.confirmationActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setSubjectToDelete(null)}
                style={({ pressed }) => [styles.cancelButton, pressed && styles.actionButtonPressed]}
              >
                <Text style={styles.cancelButtonText}>Continue</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={deleteSubject}
                style={({ pressed }) => [styles.confirmButton, pressed && styles.actionButtonPressed]}
              >
                <Text style={styles.confirmButtonText}>Delete</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
      <Modal
        animationType="fade"
        transparent
        visible={addInstitutionOpen}
        onRequestClose={() => setAddInstitutionOpen(false)}
      >
        <View style={styles.confirmationBackdrop}>
          <View style={styles.confirmationCard}>
            <Text style={styles.confirmationTitle}>Add institution</Text>
            <TextInput
              accessibilityLabel="Institution name"
              autoFocus
              onChangeText={setInstitutionNameInput}
              onSubmitEditing={submitInstitution}
              placeholder="Institution name"
              placeholderTextColor="#6d7b8b"
              returnKeyType="done"
              style={styles.urlInput}
              value={institutionNameInput}
            />
            <View style={styles.confirmationActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setAddInstitutionOpen(false)}
                style={({ pressed }) => [styles.cancelButton, pressed && styles.actionButtonPressed]}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={submitInstitution}
                style={({ pressed }) => [styles.confirmButton, styles.addClassConfirmButton, pressed && styles.actionButtonPressed]}
              >
                <Text style={styles.confirmButtonText}>Submit</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        animationType="fade"
        transparent
        visible={semesterToDelete !== null}
        onRequestClose={() => setSemesterToDelete(null)}
      >
        <View style={styles.confirmationBackdrop}>
          <View style={styles.confirmationCard}>
            <Text style={styles.confirmationTitle}>Delete semester?</Text>
            <Text numberOfLines={3} style={styles.confirmationText}>{semesterToDelete}</Text>
            <View style={styles.confirmationActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setSemesterToDelete(null)}
                style={({ pressed }) => [styles.cancelButton, pressed && styles.actionButtonPressed]}
              >
                <Text style={styles.cancelButtonText}>Close</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={deleteSemester}
                style={({ pressed }) => [styles.confirmButton, pressed && styles.actionButtonPressed]}
              >
                <Text style={styles.confirmButtonText}>Continue</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        animationType="fade"
        transparent
        visible={institutionToDelete !== null}
        onRequestClose={() => setInstitutionToDelete(null)}
      >
        <View style={styles.confirmationBackdrop}>
          <View style={styles.confirmationCard}>
            <Text style={styles.confirmationTitle}>Delete institution?</Text>
            <Text numberOfLines={3} style={styles.confirmationText}>{institutionToDelete}</Text>
            <View style={styles.confirmationActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setInstitutionToDelete(null)}
                style={({ pressed }) => [styles.cancelButton, pressed && styles.actionButtonPressed]}
              >
                <Text style={styles.cancelButtonText}>Close</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={deleteInstitution}
                style={({ pressed }) => [styles.confirmButton, pressed && styles.actionButtonPressed]}
              >
                <Text style={styles.confirmButtonText}>Continue</Text>
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
  mapScreen: {
    flex: 1,
  },
  gpaScreen: {
    backgroundColor: '#ffffff',
    flex: 1,
    padding: 22,
  },
  gpaHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 20,
  },
  gpaTitle: {
    color: '#153b75',
    flex: 1,
    fontSize: 28,
    fontWeight: '700',
  },
  gpaSummary: {
    alignItems: 'center',
    backgroundColor: '#efffff',
    borderColor: '#b9dedd',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  gpaSummaryLabel: {
    color: '#153b75',
    fontSize: 16,
    fontWeight: '700',
  },
  gpaSummaryValue: {
    color: '#16803c',
    fontSize: 24,
    fontWeight: '700',
  },
  gpaCreditsSummary: {
    alignItems: 'flex-end',
  },
  gpaCreditsValue: {
    color: '#153b75',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 2,
  },
  addClassButton: {
    flex: 0,
    paddingHorizontal: 18,
  },
  addSubjectButton: {
    flex: 0,
    paddingHorizontal: 12,
  },
  semesterSubmitButton: {
    flex: 0,
    marginLeft: 8,
    paddingHorizontal: 16,
  },
  semesterFormRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 20,
  },
  semesterInput: {
    flex: 1,
  },
  semesterCardButton: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    minHeight: 58,
  },
  subjectCard: {
    alignItems: 'center',
    backgroundColor: '#efffff',
    borderColor: '#b9dedd',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 72,
    paddingLeft: 16,
  },
  subjectDetails: {
    flex: 1,
    paddingVertical: 12,
  },
  subjectMeta: {
    color: '#6d7b8b',
    fontSize: 13,
    marginTop: 5,
  },
  editButton: {
    backgroundColor: '#b9dedd',
    borderRadius: 8,
    marginRight: 6,
    paddingHorizontal: 9,
    paddingVertical: 8,
  },
  editButtonText: {
    color: '#153b75',
    fontSize: 13,
    fontWeight: '700',
  },
  gradeOptions: {
    borderColor: '#b9dedd',
    borderWidth: 1,
    marginBottom: 10,
  },
  gradeOption: {
    borderBottomColor: '#e3eeee',
    borderBottomWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  gpaClassList: {
    gap: 12,
    paddingBottom: 24,
  },
  gpaClassCard: {
    alignItems: 'center',
    backgroundColor: '#efffff',
    borderColor: '#b9dedd',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 58,
    paddingLeft: 16,
  },
  gpaClassName: {
    color: '#153b75',
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
  },
  institutionArrow: {
    color: '#153b75',
    fontSize: 30,
    paddingHorizontal: 16,
  },
  mapSearchContainer: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#b9dedd',
    borderRadius: 24,
    borderWidth: 1,
    elevation: 5,
    flexDirection: 'row',
    left: 16,
    position: 'absolute',
    right: 16,
    shadowColor: '#153b75',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    top: 14,
    zIndex: 2,
  },
  mapSearchInput: {
    color: '#153b75',
    fontSize: 16,
    flex: 1,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  mapSearchButton: {
    backgroundColor: '#153b75',
    borderRadius: 18,
    marginRight: 6,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  mapSearchButtonPressed: {
    backgroundColor: '#2b639c',
  },
  mapSearchButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  mapSearchResults: {
    backgroundColor: '#ffffff',
    borderColor: '#b9dedd',
    borderRadius: 12,
    borderWidth: 1,
    elevation: 5,
    left: 16,
    overflow: 'hidden',
    position: 'absolute',
    right: 16,
    shadowColor: '#153b75',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    top: 70,
    zIndex: 2,
  },
  mapSearchStatus: {
    color: '#6d7b8b',
    fontSize: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  mapSearchResult: {
    borderBottomColor: '#e3eeee',
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  mapSearchResultPressed: {
    backgroundColor: '#efffff',
  },
  mapSearchResultTitle: {
    color: '#153b75',
    fontSize: 15,
    fontWeight: '700',
  },
  mapSearchResultText: {
    color: '#6d7b8b',
    fontSize: 12,
    marginTop: 3,
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
  mapSettingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingVertical: 18,
  },
  mapSettingText: {
    flex: 1,
    paddingRight: 12,
  },
  universityMarkerOptions: {
    gap: 12,
    marginTop: 4,
    paddingLeft: 4,
  },
  universityMarkerOption: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 32,
  },
  universityMarkerOptionDisabled: {
    opacity: 0.45,
  },
  universityMarkerOptionText: {
    color: '#153b75',
    fontSize: 15,
  },
  universityMarkerRadio: {
    alignItems: 'center',
    borderColor: '#2b639c',
    borderRadius: 10,
    borderWidth: 2,
    height: 20,
    justifyContent: 'center',
    marginRight: 10,
    width: 20,
  },
  universityMarkerRadioSelected: {
    backgroundColor: '#2b639c',
    borderRadius: 5,
    height: 10,
    width: 10,
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
  universitySelector: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#b9dedd',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 50,
    paddingHorizontal: 14,
  },
  universitySelectorText: {
    color: '#153b75',
    flex: 1,
    fontSize: 16,
  },
  universityPlaceholder: {
    color: '#6d7b8b',
    flex: 1,
    fontSize: 16,
  },
  universitySelectorArrow: {
    color: '#153b75',
    fontSize: 12,
    marginLeft: 12,
  },
  universityOptions: {
    backgroundColor: '#ffffff',
    borderColor: '#b9dedd',
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 6,
    maxHeight: 260,
  },
  universityOption: {
    borderBottomColor: '#e3eeee',
    borderBottomWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  universityOptionText: {
    color: '#153b75',
    fontSize: 15,
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
  addClassConfirmButton: {
    backgroundColor: '#153b75',
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
