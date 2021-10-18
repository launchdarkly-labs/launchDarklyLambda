const LaunchDarkly = require("launchdarkly-node-server-sdk");
const client = LaunchDarkly.init("sdk-my-sdk-key");

exports.handler = async (event) => {
  const request = event.Records[0].cf.request;
  const hostURL = request.headers.host[0].value;
  // all our files are under /site
  let URI = request.uri.replace("/site", "");
  // remove the beta if they added it manually
  URI = request.uri.replace("/beta", "");
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
