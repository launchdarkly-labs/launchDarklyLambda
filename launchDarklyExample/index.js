const LaunchDarkly = require("launchdarkly-node-server-sdk");
const client = LaunchDarkly.init("my-sdk-key");

exports.handler = async (event) => {
  const request = event.Records[0].cf.request;
  const hostURL = request.headers.host[0].value;
  // all our files are under /site
  const URI = request.uri.replace("/site", "");
  await client.waitForInitialization();
  const landingPage = await client.variation(
    "rebrand",
    { key: request.clientIp },
    false
  );
  const URL = hostURL + landingPage + URI;
  return {
    status: "302",
    statusDescription: "Found",
    headers: {
      location: [
        {
          key: "Location",
          value: URL,
        },
      ],
    },
  };
};
