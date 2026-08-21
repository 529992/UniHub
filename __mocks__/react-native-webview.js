const React = require('react');
const { View } = require('react-native');

module.exports = function WebViewMock(props) {
  return React.createElement(View, props);
};