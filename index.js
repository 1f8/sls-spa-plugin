'use strict';

const spawnSync = require('child_process').spawnSync;

class ServerlessPlugin {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.commands = {
      syncToS3: {
        usage: 'Deploys the `app` directory to your bucket',
        lifecycleEvents: [
          'sync',
        ],
      },
      domainInfo: {
        usage: 'Fetches and prints out the deployed CloudFront domain names',
        lifecycleEvents: [
          'domainInfo',
        ],
      },
      invalidateCloudFrontCache: {
        usage: 'Invalidates CloudFront cache',
        lifecycleEvents: [
          'invalidateCache',
        ],
      },
    };

    this.hooks = {
      'syncToS3:sync': this.syncDirectory.bind(this),
      'domainInfo:domainInfo': this.domainInfo.bind(this),
      'invalidateCloudFrontCache:invalidateCache': this.invalidateCache.bind(
        this,
      ),
    };
  }

  runAwsCommand(args) {
    // FOR WINDOWS
    // const result = spawnSync('cmd.exe', ['/c', 'aws'].concat(args));
    // return result;
    // FOR NON-WINDOWS
    this.serverless.cli.log('SPA command', ['aws', ...args].join(' '))
    const result = spawnSync('aws', args);

    const stdout = result.stdout;
    const sterr = result.stderr;
    if (stdout) {
      this.serverless.cli.log(stdout.toString());
    }
    if (sterr) {
      this.serverless.cli.log(sterr.toString());
    }

    return { stdout, sterr };
  }

  // syncs the `client/dist` directory to the provided bucket
  syncDirectory() {

    // check if distribution was specified
    let { bucketName, path, profile } = this.getOptions()

    // fallback bucketname to custom bucket names
    if (!bucketName) {
      const s3Bucket = this.serverless.variables.service.custom.resources.s3Bucket || this.serverless.variables.service.custom.resources.s3WebappBucket;
      bucketName = s3Bucket
    }

    const args = [
      's3',
      'sync',
      path,
      `s3://${bucketName}/`,
      '--delete',
    ];
    if (profile) {
      this.serverless.cli.log(`Using profile: ${profile}`)
      args.push('--profile')
      args.push(profile)
    }

    this.serverless.cli.log('Syncing to ' + bucketName);
    this.runAwsCommand(args);

    // const { stdout, sterr } = this.runAwsCommand(args);
    // if (sterr) {
    //   throw new Error('Failed syncing to the S3 bucket');
    // } else if (!stdout) {
    //   throw new Error('Failed to get response from S3 bucket');
    // } else {
    //   this.serverless.cli.log('Successfully synced to the S3 bucket');
    // }
  }

  // fetches the domain name from the CloudFront outputs and prints it out
  async domainInfo() {
    const provider = this.serverless.getProvider('aws');
    const stackName = provider.naming.getStackName(this.options.stage);
    const result = await provider.request(
      'CloudFormation',
      'describeStacks',
      { StackName: stackName },
      this.options.stage,
      this.options.region,
    );

    const outputs = result.Stacks[0].Outputs;
    const output = outputs.find(
      entry => entry.OutputKey === 'WebAppCloudFrontDistributionOutput',
    );

    if (output && output.OutputValue) {
      this.serverless.cli.log(`Web App Domain: ${output.OutputValue}`);
      return output.OutputValue;
    }

    this.serverless.cli.log('Web App Domain: Not Found');
    const error = new Error('Could not extract Web App Domain');
    throw error;
  }

  getOptions() {
    const spaOptions = this.serverless.variables.service.custom.spa

    let stage = this.options.stage
    try {
      stage = this.serverless.variables.service.custom.stage
    } catch {
      this.serverless.cli.log('SPA - Recommended to set stage in custom variables')
    }

    let bucket, distributionId
    if (stage==='prod') {
      bucket= spaOptions.bucketProd
      distributionId = spaOptions.distributionProd
    }

    if (stage==='dev') {
      bucket= spaOptions.bucketDev
      distributionId = spaOptions.distributionDev
    }

    const profile = this.serverless.variables.service.provider.profile

    return {
      ...spaOptions,
      bucket, distributionId, stage,
      profile,
    }
  }

  async invalidateCache() {
    // check if distribution was specified
    let { distributionId, profile } = this.getOptions()

    // get distributid if not specified
    if (!distributionId) {
      const provider = this.serverless.getProvider('aws');
      const domain = await this.domainInfo();
      const result = await provider.request(
        'CloudFront',
        'listDistributions',
        {},
        this.options.stage,
        this.options.region,
      );

      const distributions = result.DistributionList.Items;
      const distribution = distributions.find(
        entry => entry.DomainName === domain,
      );
      if (distribution) {
        distributionId = distribution.id
      }
    }

    if (distributionId) {
      this.serverless.cli.log(
        `Invalidating CloudFront distribution with id: ${distributionId}`,
      );
      const args = [
        'cloudfront',
        'create-invalidation',
        '--distribution-id',
        distributionId,
        '--paths',
        '/*',
      ];
      if (profile) {
        this.serverless.cli.log(
          `Using profile: ${profile}`,
        )
        args.push('--profile')
        args.push(profile)
      }
      const { stdout, sterr } = this.runAwsCommand(args);
      if (stdout) {
        this.serverless.cli.log('Successfully invalidated CloudFront cache');
      } else {
        throw new Error('Failed invalidating CloudFront cache', sterr);
      }
    } else {
      const message = `Could not find distribution with domain ${domain}`;
      const error = new Error(message);
      this.serverless.cli.log(message);
      throw error;
    }
  }
}

module.exports = ServerlessPlugin;
