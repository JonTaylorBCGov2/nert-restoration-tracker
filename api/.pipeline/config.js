'use strict';

let options = require('pipeline-cli').Util.parseArguments();

// The root config for common values
const config = require('../../.config/config.json');

const name = config.module.api;
const dbName = config.module.db;

const version = config.version;

const changeId = options.pr; // pull-request number or branch name

// A static deployment is when the deployment is updating dev, test, or prod (rather than a temporary PR)
// See `--type=static` in the `deployStatic.yml` git workflow
const isStaticDeployment = options.type === 'static';

const deployChangeId = (isStaticDeployment && 'deploy') || changeId;
const branch = (isStaticDeployment && options.branch) || null;
const tag = (branch && `build-${version}-${changeId}-${branch}`) || `build-${version}-${changeId}`;

const staticUrlsAPI = config.staticUrlsAPI || {};

const processOptions = (options) => {
  const result = { ...options };

  // Check git
  if (!result.git.url.includes('.git')) {
    result.git.url = `${result.git.url}.git`;
  }

  if (!result.git.http_url.includes('.git')) {
    result.git.http_url = `${result.git.http_url}.git`;
  }

  // Fixing repo
  if (result.git.repository.includes('/')) {
    const last = result.git.repository.split('/').pop();
    const final = last.split('.')[0];
    result.git.repository = final;
  }

  return result;
};

options = processOptions(options);

const phases = {
  build: {
    namespace: 'b1d40d-tools',
    name: `${name}`,
    dbName: `${dbName}`,
    phase: 'build',
    changeId: changeId,
    suffix: `-build-${changeId}`,
    instance: `${name}-build-${changeId}`,
    version: `${version}-${changeId}`,
    tag: tag,
    env: 'build',
    tz: config.timezone.api,
    branch: branch,
    cpuRequest: '100m',
    cpuLimit: '1250m',
    memoryRequest: '512Mi',
    memoryLimit: '3Gi'
  },
  dev: {
    namespace: 'b1d40d-dev',
    name: `${name}`,
    dbName: `${dbName}`,
    phase: 'dev',
    changeId: deployChangeId,
    suffix: `-dev-${deployChangeId}`,
    instance: `${name}-dev-${deployChangeId}`,
    version: `${deployChangeId}-${changeId}`,
    tag: `dev-${version}-${deployChangeId}`,
    host: (isStaticDeployment && staticUrlsAPI.dev) || `${name}-${changeId}-b1d40d-dev.apps.silver.devops.gov.bc.ca`,
    env: 'dev',
    elasticsearchURL: 'http://es01.a0ec71-prod:9200',
    elasticsearchTaxonomyIndex: 'taxonomy_3.0.0',
    s3KeyPrefix: (isStaticDeployment && 'restoration') || `local/${deployChangeId}/restoration`,
    tz: config.timezone.api,
    sso: config.sso.dev,
    logLevel: 'debug',
    cpuRequest: '100m',
    cpuLimit: '500m',
    memoryRequest: '512Mi',
    memoryLimit: '1.6Gi',
    replicas: '1',
    replicasMax: (isStaticDeployment && '2') || '1'
  },
  test: {
    namespace: 'b1d40d-test',
    name: `${name}`,
    dbName: `${dbName}`,
    phase: 'test',
    changeId: deployChangeId,
    suffix: `-test`,
    instance: `${name}-test`,
    version: `${version}`,
    tag: `test-${version}`,
    host: staticUrlsAPI.test,
    env: 'test',
    elasticsearchURL: 'http://es01.a0ec71-prod:9200',
    elasticsearchTaxonomyIndex: 'taxonomy_3.0.0',
    s3KeyPrefix: 'restoration',
    tz: config.timezone.api,
    sso: config.sso.test,
    logLevel: 'info',
    cpuRequest: '200m',
    cpuLimit: '1000m',
    memoryRequest: '512Mi',
    memoryLimit: '2Gi',
    replicas: '2',
    replicasMax: '3'
  },
  prod: {
    namespace: 'b1d40d-prod',
    name: `${name}`,
    dbName: `${dbName}`,
    phase: 'prod',
    changeId: deployChangeId,
    suffix: `-prod`,
    instance: `${name}-prod`,
    version: `${version}`,
    tag: `prod-${version}`,
    host: staticUrlsAPI.prod,
    env: 'prod',
    elasticsearchURL: 'http://es01.a0ec71-prod:9200',
    elasticsearchTaxonomyIndex: 'taxonomy_3.0.0',
    s3KeyPrefix: 'restoration',
    tz: config.timezone.api,
    sso: config.sso.prod,
    logLevel: 'info',
    cpuRequest: '200m',
    cpuLimit: '1000m',
    memoryRequest: '512Mi',
    memoryLimit: '2Gi',
    replicas: '2',
    replicasMax: '3'
  }
};

module.exports = exports = { phases, options };
