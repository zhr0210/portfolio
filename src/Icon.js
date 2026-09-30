"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }var _react = __r(1); var _react2 = _interopRequireDefault(_react);
const paths = {
  arrow: 'M5 12h14M13 6l6 6-6 6', diagonal: 'M6 18 18 6M6 6h12v12', down: 'M12 4v16M5 13l7 7 7-7',
  close: 'M6 6l12 12M18 6 6 18', plus: 'M12 5v14M5 12h14', play: 'm8 5 11 7-11 7Z',
  reset: 'M3 10a9 9 0 1 1 1 7M3 4v6h6', copy: 'M9 9h11v11H9ZM4 15H3V3h12v1',
  download: 'M12 3v12M7 10l5 5 5-5M4 16v5h16v-5', mail: 'M3 5h18v14H3ZM3 5l9 8 9-8',
  check: 'm4 12 5 5L20 6', chevron: 'm9 5 7 7-7 7', sparkle: 'm12 2 2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6Z',
};
 function Icon({ name = 'arrow', size = 18, ...props }) {
  return _react2.default.createElement('svg', { width: size, height: size, viewBox: "0 0 24 24"   , fill: "none", stroke: "currentColor", strokeWidth: "1.4", strokeLinecap: "round", strokeLinejoin: "round", 'aria-hidden': "true", ...props,}, _react2.default.createElement('path', { d: paths[name] || paths.arrow,} ));
} exports.default = Icon;
