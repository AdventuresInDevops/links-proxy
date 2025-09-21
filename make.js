/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-console */

const aws = require('aws-sdk');
const { Route53Client, GetHostedZoneCommand } = require("@aws-sdk/client-route-53");
const { STSClient, GetCallerIdentityCommand } = require("@aws-sdk/client-sts");
const commander = require('commander');
const AwsArchitect = require('aws-architect');
const path = require('path');
const yaml = require('js-yaml');
const fs = require('fs-extra');

aws.config.update({ region: 'us-east-1' });

const packageMetadataFile = path.join(__dirname, 'package.json');
const packageMetadata = require(packageMetadataFile);

function getVersion() {
  let release_version = '0.0';
  const pull_request = '';
  const branch = process.env.GITHUB_REF;
  const build_number = process.env.GITHUB_RUN_NUMBER;

  //Builds of pull requests
  if (pull_request && !pull_request.match(/false/i)) {
    release_version = `0.${pull_request}`;
  } else if (!branch || !branch.match(/^(refs\/heads\/)?release[/-]/i)) {
    //Builds of branches that aren't master or release
    release_version = '0.0';
  } else {
    //Builds of release branches (or locally or on server)
    release_version = branch.match(/^(?:refs\/heads\/)?release[/-](\d+(?:\.\d+){0,3})$/i)[1];
  }
  return `${release_version}.${(build_number || '0')}.0.0.0.0`.split('.').slice(0, 3).join('.');
}
const version = getVersion();
commander.version(version);


const parameters = { hostedName: 'dev0ps.fyi' };

const contentOptions = {
  bucket: parameters.hostedName,
  contentDirectory: path.join(__dirname, 'build')
};

/**
  * Build
  */
commander
.command('build')
.description('Setup require build files for npm package.')
.action(async () => {
  let package_metadata = require('./package.json');
  package_metadata.version = version;
  await fs.writeJson('./package.json', package_metadata, { spaces: 2 });

  console.log('Building package %s (%s)', package_metadata.name, version);
  console.log('');
});

commander
.command('deploy')
.description('Deploying website to AWS.')
.action(async () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const stackTemplateProvider = require('./template/cloudFormationWebsiteTemplate');
  const requestInterceptorLambdaFunction = await fs.readFile(path.join(__dirname, 'template/requestInterceptorLambdaFunction.js'));
  const stackTemplate = stackTemplateProvider.getStack(requestInterceptorLambdaFunction.toString());
  
  const callerIdentityResponse = await client.send(new GetCallerIdentityCommand({}));
  const apiOptions = {
    deploymentBucket: `rhosys-deployments-artifacts-${callerIdentityResponse.Account}-${aws.config.region}`
  };
  const awsArchitect = new AwsArchitect(packageMetadata, apiOptions, contentOptions);

  const isProductionBranch = process.env.GITHUB_REF === 'refs/heads/main';

  try {
    await awsArchitect.validateTemplate(stackTemplate);

    if (isProductionBranch) {
      const stackConfiguration = {
        changeSetName: `${process.env.GITHUB_REPOSITORY.replace(/[^a-z0-9]/ig, '-')}-${process.env.GITHUB_RUN_NUMBER || '1'}`,
        stackName: packageMetadata.name,
        automaticallyProtectStack: true
      };

      const config = {};
      const client = new Route53Client(config);
      const command = new ListHostedZonesByNameCommand({ DNSName: parameters.hostedName });
      const response = await client.send(command);
      const hostedZoneId = response.HostedZones[0].Id;
      parameters.hostedZoneId = hostedZoneId;
      await awsArchitect.deployTemplate(stackTemplate, stackConfiguration, parameters);
    }

    console.log(`Deployed to ${deploymentLocation}`);
  } catch (failure) {
    console.log(`Failed to upload website ${failure} - ${JSON.stringify(failure, null, 2)}`);
    process.exit(1);
  }
});

commander.on('*', () => {
  if (commander.args.join(' ') === 'tests/**/*.js') {
    return;
  }
  console.log(`Unknown Command: ${commander.args.join(' ')}`);
  commander.help();
  process.exit(0);
});
commander.parse(process.argv[2] ? process.argv : process.argv.concat(['build']));
