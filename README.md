# Using LaunchDarkly with AWS Lambda

## Scenario

Your company is launching a rebrand, which includes a new site relaunch as part of it. This is a major undertaking and the marketing department wants to be sure that everything is perfect. Rather than simply flip the switch from one day to the next, they want to roll out the new site to an increasing percentage of users to ensure everything looks good before eventually transitioning everyone to the new page. How can we do this without it becoming a major DevOps headache?

LaunchDarkly provides tools that eliminate the DevOps headaches involved in this while also allowing the marketing team full control of the rollout. To accomplish this task, we'll use a LaunchDarkly feature flag to assign each user to a variation (either new site or old site) and then an AWS Lambda@Edge function to route them to the appropriate version of the site at the edge rather than relying on a client-side or server-side redirect.

## What You'll Need

Besides an AWS account and a LaunchDarkly account, you'll just need a way to build and deploy a Lambda function. The instructions here will be leveraging the [AWS Toolkit for Visual Studio Code](https://docs.aws.amazon.com/toolkit-for-visual-studio/latest/user-guide/setup.html) to allow us to easily upload and test our Lambda Function.

## Setting Up AWS

Within AWS, we'll need to create two different resources to complete this challenge.

1. **An S3 Bucket** – This will house our simple "web site." The site has an index page in the root as well as a `/beta` folder that contains the same. page with the new branding. Once the challenge is complete, users will either be directed to the old site or the new site depending on which variation they are assigned to within LaunchDarkly. LaunchDarkly determines this by assigning each unique user (identified by their key in this scenario) according to the percentage rollout we'll define.
2. **A CloudFront Distribution** – This is required to run a Lambda function via AWS's edge servers (i.e. Lambda@Edge). Since the goal of this challenge is to redirect users to the proper site, this is better done "at the edge" so as to limit any latency the user might see during the request. Rather than intercept the request on the server and do a server-side redirect or performing some kind of client-side redirect, we can intercept this request at the CDN level closest to the user and direct it to the proper version of the site.

### CloudFormation

To get started, we can use the CloudFormation template.

1. In the AWS console, search for CloudFormation and then click the "Create stack" button.
2. Choose the "Template is Ready" and "Upload a Template". Select the template file (`CloudFormationTemplate`) that you downloaded from this repository. Click Next.
3. Name the stack (For example "LaunchDarkly-Challenge") and click next.
4. On the "Configure stack options" step, accept all the defaults and click next.
5. Review the details and click "Create stack". You'll have to wait for the stack to be created before continuing (this can take a few minutes).

You can optionally manually set up both the S3 bucket and CloudFront distribution. The instructions for both are below.

### Manually Setting Up an S3 Bucket with the Challenge Resources

1. Search for S3 in the AWS console. Click the "Create bucket" button.
2. Give the bucket a name (for example, "launchdarkly-example"), choose US East as the AWS Region and turn off the "block public access" option.
3. Click the "Upload" button and then "Add folder". Upload the `/site` folder containing the both the existing site's `index.html` and `logo.png` and a `/beta` folder containing the new site (Note that to simplify these steps, we're uploading everything into a folder rather than into the root of the bucket, but this means that the URLs will all have to have the `/site` folder appended). Click "Upload" and when it's done click "Close"
4. Select the `site` directory in your bucket and from the Actions pull down select "Make public", click to confirm and then click "Close"
5. Click on the "Properties" tab for the S3 bucket. Scroll all the way down to "Static website hosting". Click "Edit" and then choose "Enable". Specify `index.html` as your index document and "Save changes".

   You should be able to click the bucket URL to view the page (be sure to append `/site` at the end of the URL). Take note of this URL as we'll need it later.

### Manually Setting Up the CloudFront distribution

1. In the AWS Console, search for "CloudFront" and then click the button that reads "Create a CloudFront Distribution"

2. For the "Origin domain" choose the S3 bucket we just created. Leave everything else with the default, scroll down and click "Create distribution"

## Creating a Lambda Function Connected to LaunchDarkly

1. Within the AWS console, search for "Lambda"
2. Click "Create function"
3. Choose "Author from Scratch". Name the function "launchDarklyExample" and choose the Node.js runtime (which is the default). Everything else can also be left at the default. Click "Create Function".

Our function is created, so now let's move to VS Code.

1. Create or open an empty project
2. Click the AWS icon on the left (this is part of the [AWS Toolkit for Visual Studio Code](https://docs.aws.amazon.com/toolkit-for-visual-studio/latest/user-guide/setup.html))
3. Choose Lambda and then find the "launchDarklyExample" we just created. Right-click on the function and select "Download". When prompted choose the current project folder.

### Install and Configure LaunchDarkly

1. Open the command line in the current project folder (be sure you `cd` into the `launchDarklyExample` folder containing your lambda function)
2. Run `npm install launchdarkly-node-server-sdk`

3. Place the following code above the handler in `index.js`. Be sure to replace the `sdk-my-sdk-key` with your SDK key from your LaunchDarkly environment. You can get this via the "Account settings" within the LaunchDarkly dashboard:

   ```javascript
   const LaunchDarkly = require("launchdarkly-node-server-sdk");
   const client = LaunchDarkly.init("sdk-my-sdk-key");
   ```

   Note that we are not placing the SDK key in an environment variable because environment variables cannot be used in Lambda@Edge.

4. Let's test our setup by initializing LaunchDarkly and returning a response indicating whether it has succeeded or failed.

   ```javascript
   exports.handler = async (event) => {
     let response = {
       statusCode: 200,
     };
     try {
       await client.waitForInitialization();
       response.body = JSON.stringify("Initialization successful");
     } catch (err) {
       response.body = JSON.stringify("Initialization failed");
     }
     return response;
   };
   ```

5. To update our Lambda function, including uploading the npm dependencies, open the AWS panel in VS Code. Right-click the function and select "Upload". When prompted, choose "Directory" and then select the directory that the Lambda function resides in. When it asks you whether to build with SAM, choose "No" to just upload the contents of the directory.
6. To test the function, right-click on the function again and choose "Invoke on AWS". We do not need to provide any payload, just click the "invoke" button. The output panel should show a response `{"statusCode":200,"body":"\"Initialization successful\""}` showing that the SDK client properly initialized.

### Creating a Flag in LaunchDarkly

LaunchDarkly is now initialized, but we need a flag to respond to.

1. Open the LaunchDarkly dashboard and select our project (the default project works fine) and environment (either the default "Test" or "Production" are fine, just be sure to change the flag in the same environment later) then click "Create flag".
2. Name the flag "rebrand". We do not need a mobile or client side ID, so we can uncheck that. Choose a "Boolean" variation.
3. Variation 1 should be true make variation 2 will be false. True will indicate that we should see the new site. False will indicate that we should continue to see the old site.
4. Click "Save flag".

5. Once the flag is saved, scroll down to the "Default rule" and choose the "A percentage rollout" option. For the purposes of example, we'll just assign 50/50 but in a real world scenario you'd likely start smaller and increase over time.

6. Scroll back up and click save.
7. Finally, turn targeting On and save again. If we don't turn targeting on, the percentage rollout is not running and you'll only ever get the default variation).

### Getting a Flag Value in Lambda

Now let's use our new flag within our function.

1. Replace the handler to the following to call our flag. We'll use our email as a static key for the moment. The key is what will determine whether we are served the same variation or a new one based upon our rollout percentages. We're hardcoding the key for the moment, so we'll always get the same result regardless of how many times we run it.
   ```javascript
   exports.handler = async (event) => {
     let response = {
       statusCode: 200,
     };
     await client.waitForInitialization();
     let landingPage = await client.variation(
       "rebrand",
       { key: "brinaldi@launchdarkly.com" },
       false
     );
     response.body = JSON.stringify(landingPage);
     return response;
   };
   ```
2. Open the AWS panel. Right-click to upload and then, when the upload finishes, right click to invoke it again. You do not need a payload. You should receive a response like `{"statusCode":200,"body":"\"/site/beta\""}`.

## Deploying Our Function to Lambda@Edge

We've now successfully used this in a Lambda but we're not yet using Lambda@Edge. A function running on Lambda@Edge receives a specific [event structure](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/lambda-event-structure.html). We'll utilize this to specify a key for LaunchDarkly that will ensure that different users get different variations but the same user always end up in the same group (i.e. they don't see one site on one click and one site on another, which would be bad).

Let's update our function to use this event. The following code gets the value of the flag and appends that to the URL for our site, so that you'll either be directed to the existing site or to a `/beta` version of the site (note that a more complete solution wouldn't just append the beta but redirect users to the page they requested on the new site using the URI passed in the event, however our site only has one page). It uses the IP address of the user as the key since it is the only indentifying information we will always have available for the user. Subsequent visits from that IP will not get different results from the flag (i.e. they'll continue to see the same version of the site).

```javascript
exports.handler = async (event) => {
  // place your S3 bucket URL here -- don't forget to add /site/
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
```

After updating the code, use the AWS panel in VS Code to upload it again.

### Testing Our Lambda@Edge Function

In order to test the function, we'll need to provide a payload that represents the Lambda@Edge event structure. Open the AWS panel in VS Code. Right-click on the function and select "Invoke on AWS". From the sample request payload dropdown, choose the "Cloudfront HTTP Redirect" and then click "Invoke". You should get a response like:

```json
{
  "status": "302",
  "statusDescription": "Found",
  "headers": {
    "location": [
      {
        "key": "Location",
        "value": "https://launchdarklydemostack1-s3bucketforwebsitecontent-jffmp2434grq.s3.amazonaws.com/site/beta/"
      }
    ]
  }
}
```

Try changing the IP address in the payload and clicking invoke again. You should get a different response in most cases as it's split 50/50 (though you may need to change the IP more than once try again as the ultimate percentage breakdown will be 50/50 but that doesn't mean each request is alternated).

### Connecting a CloudFront Trigger

Now let's enable our Lambda for Lambda@Edge by adding a CloudFront trigger. Before we can do that, we need to update the execution role of our function. In the AWS console, search for Lambda and then select our function. Go to the Configuration tab for the Lambda function, click Permissions, then under Execution role click Edit.

![Changing the execution role](aws-lambda-execution.png)

In the "Existing Role" dropdown, select "service-role/lambdaEdge". You don't need to change any other settings. Click save.

![Changing the service role to lambdaEdge](aws-lambda-service-role.png)

Now we're ready to enable the trigger.

1. Open your Lambda Function and click the "Add trigger" button.
2. In "Select a trigger" dropdown search for "CloudFront" and then click the button to "Deploy to Lambda@Edge". Change the CloudFront event to "Viewer request". This ensures that the Lambda will execute on every request before the cache is checked. If we used "Origin request", the cache would be checked and flag changes after the initial run would pull from this cache, missing any changes to the flag status. Otherwise, accept the defaults and click "Deploy".

3. Click deploy. You will likely get asked to select the trigger again, be sure that both times you choose the "Origin request" option while leaving the rest as default values.

Finally, let's test that this actually works. Click the "CloudFront" box within the "Function Overview". This should open the Configuration > Triggers settings. Click the link next to the CloudFront trigger that has our CloudFront distribution ID. This will open up the CloudFront distribution in a new tab. Open the CloudFront distribution and under the "Details" section, copy the URL for this CloudFront distribution. If we paste this URL in the browser (be sure the CloudFront distribution has finished deploying first), it should direct us to either the old version of the page or the new one.

If you are assigned to the old site but want to see the new site, or want to test what the full rollout would look like, go to your LaunchDarkly dashboard, open the "rebrand" flag and under "Default rule" change it from serving a percentage rollout to just serving true. Save the changes to your flag and go to the CloudFront domain again and you should be directed to the beta site.

Congrats! You've completed the challenge. If you need to cleanup your environment, follow the instructions below.

#### Cleanup

If you'd like to clean up your AWS evironment when you complete this challenge, here's the steps.

1. You'll need to remove the CloudFront association following instructions here: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/lambda-edge-delete-replicas.html
2. Go to the Behaviors tab of your CloudFront distribution, edit the behavior and remove the Function association for LambdaEdge. Once the distrubution deploys, you can delete the Lambda function.
3. You'll need to empty the S3 bucket before you can delete it.
4. You'll need to disable the CloudFront distribution before you can delete it. Once it deploys after disabling you can delete the distribution.
