module.exports = {
  preset: '@react-native/jest-preset',
  moduleNameMapper: {
    '^@react-native-async-storage/async-storage$': '<rootDir>/__mocks__/@react-native-async-storage-async-storage.js',
    '^react-native-webview$': '<rootDir>/__mocks__/react-native-webview.js',
  },
};
