const React = require('react');
const { View } = require('react-native');

const Camera = React.forwardRef((props, ref) => React.createElement(View, { ...props, ref }));

module.exports = {
  Camera,
  useCameraDevice: () => ({ id: 'mock-back-camera', position: 'back' }),
  useCameraPermission: () => ({ hasPermission: true, requestPermission: jest.fn() }),
  usePhotoOutput: () => ({ capturePhotoToFile: jest.fn(async () => ({ filePath: '/tmp/mock-photo.jpg' })) }),
};
