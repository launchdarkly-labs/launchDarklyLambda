const LaunchDarkly = require("launchdarkly-node-server-sdk");
const client = LaunchDarkly.init("sdk-my-sdk-key");

exports.handler = async (event, context, callback) => {
  const request = event.Records[0].cf.request;
  const c = request.headers.host[0].value;

  // initialize LaunchDarkly and get the flag value
  await client.waitForInitialization();
  const viewNewSite = await client.variation(
    "rebrand",
    { key: request.clientIp },
    false
  );
  console.log(`LaunchDarkly returned "${viewNewSite}"`);

  // if they aren't being redirected to the new site just return them to whatever they requested
  // or if they are already on the beta site
  if (!viewNewSite || request.url.includes("/beta")) {
    return callback(null, request);
    // otherwise redirect them to the beta site
  } else {
    let URL =
      "http://" +
      hostname +
      "/beta" +
      request.uri.replace("/beta", "") +
      (request.querystring === "" ? "" : "?" + request.querystring);
    const response = {
      status: "301",
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

    callback(null, response);
  }
};
