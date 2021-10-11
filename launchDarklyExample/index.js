const LaunchDarkly = require("launchdarkly-node-server-sdk");
const client = LaunchDarkly.init("my-sdk-key");

exports.handler = async (event) => {
  const s3url =
    "http://launchdarkly-example.s3-website-us-east-1.amazonaws.com";

  await client.waitForInitialization();
  let landingPage = await client.variation(
    "rebrand",
    { key: event.Records[0].cf.request.clientIp },
    false
  );
  return {
    status: "302",
    statusDescription: "Found",
    headers: {
      location: [
        {
          key: "Location",
          value: s3url + landingPage,
        },
      ],
    },
  };
};
