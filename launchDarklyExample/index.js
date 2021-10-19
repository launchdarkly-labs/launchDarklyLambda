const LaunchDarkly = require("launchdarkly-node-server-sdk");
const client = LaunchDarkly.init("sdk-c46b880d-5973-48ed-9f01-838029b10e99");

exports.handler = async (event) => {
  let URL =
    "https://launchdarklydemostack1-s3bucketforwebsitecontent-jffmp2434grq.s3.amazonaws.com/site/";

  await client.waitForInitialization();
  let viewBetaSite = await client.variation(
    "rebrand",
    { key: event.Records[0].cf.request.clientIp },
    false
  );
  console.log(`LaunchDarkly returned ${viewBetaSite}`);

  if (viewBetaSite) URL += "beta/index.html";
  else URL += "index.html";
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
