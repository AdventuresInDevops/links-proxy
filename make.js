/* eslint-disable node/no-unpublished-import */
/* eslint-disable no-console */

import aws from 'aws-sdk';
import { Route53Client, ListHostedZonesByNameCommand } from '@aws-sdk/client-route-53';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import commander from 'commander';
import AwsArchitect from 'aws-architect';
import path from 'path';
import fs from 'fs-extra';

import stackTemplateProvider from './template/cloudFormationWebsiteTemplate.js';

aws.config.update({ region: 'us-east-1' });

const underscoreDirname = path.dirname(import.meta.url).replace('file:', '');
const packageMetadataFile = path.join(underscoreDirname, 'package.json');
const packageMetadata = await fs.readJson(packageMetadataFile);

function getVersion() {
  let release_version = '0.0';
  const pull_request = '';
  const branch = process.env.GITHUB_REF;
  const build_number = process.env.GITHUB_RUN_NUMBER;

  // Builds of pull requests
  if (pull_request && !pull_request.match(/false/i)) {
    release_version = `0.${pull_request}`;
  } else if (!branch || !branch.match(/^(refs\/heads\/)?release[/-]/i)) {
    // Builds of branches that aren't master or release
    release_version = '0.0';
  } else {
    // Builds of release branches (or locally or on server)
    release_version = branch.match(/^(?:refs\/heads\/)?release[/-](\d+(?:\.\d+){0,3})$/i)[1];
  }
  return `${release_version}.${(build_number || '0')}.0.0.0.0`.split('.').slice(0, 3).join('.');
}
const version = getVersion();
commander.version(version);

const parameters = { hostedName: 'dev0ps.fyi' };

const contentOptions = {
  bucket: parameters.hostedName,
  contentDirectory: path.join(underscoreDirname, 'build')
};

/**
  * Build
  */
commander
.command('build')
.description('Setup require build files for npm package.')
.action(async () => {
  packageMetadata.version = version;
  await fs.writeJson('./package.json', packageMetadata, { spaces: 2 });

  console.log('Building package %s (%s)', packageMetadata.name, version);
  console.log('');
});

commander
.command('deploy')
.description('Deploying website to AWS.')
.action(async () => {
  const requestInterceptorLambdaFunction = await fs.readFile(path.join(underscoreDirname, 'template/requestInterceptorLambdaFunction.js'));
  const stackTemplate = stackTemplateProvider.getStack(requestInterceptorLambdaFunction.toString());
  
  const stsClient = new STSClient({});
  const callerIdentityResponse = await stsClient.send(new GetCallerIdentityCommand({}));
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

      const route53Client = new Route53Client({});
      const command = new ListHostedZonesByNameCommand({ DNSName: parameters.hostedName });
      const response = await route53Client.send(command);
      const hostedZoneId = response.HostedZones[0].Id;
      parameters.hostedZoneId = hostedZoneId;
      await awsArchitect.deployTemplate(stackTemplate, stackConfiguration, parameters);
    }

    console.log('Deployment Success!');
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
