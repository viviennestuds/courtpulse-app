const { getSentryExpoConfig } = require("@sentry/react-native/metro");
const { withRorkMetro } = require("@rork-ai/toolkit-sdk/metro");

const config = getSentryExpoConfig(__dirname, {
  includeWebReplay: false,
});

module.exports = withRorkMetro(config);
