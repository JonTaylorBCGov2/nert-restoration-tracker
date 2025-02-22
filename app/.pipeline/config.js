'use strict';

let options = require('pipeline-cli').Util.parseArguments();

// The root config for common values
const config = require('../../.config/config.json');

const name = config.module.app;
const apiName = config.module.api;

const version = config.version;

const changeId = options.pr; // pull-request number or branch name

// A static deployment is when the deployment is updating dev, test, or prod (rather than a temporary PR)
// See `--type=static` in the `deployStatic.yml` git workflow
const isStaticDeployment = options.type === 'static';

const deployChangeId = (isStaticDeployment && 'deploy') || changeId;
const branch = (isStaticDeployment && options.branch) || null;
const tag = (branch && `build-${version}-${changeId}-${branch}`) || `build-${version}-${changeId}`;

const staticUrls = config.staticUrls || {};
const staticUrlsAPI = config.staticUrlsAPI || {};

const maxUploadNumFiles = 10;
const maxUploadFileSize = 52428800; // (bytes)

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
    phase: 'build',
    changeId: changeId,
    suffix: `-build-${changeId}`,
    instance: `${name}-build-${changeId}`,
    version: `${version}-${changeId}`,
    tag: tag,
    env: 'build',
    branch: branch,
    cpuRequest: '100m',
    cpuLimit: '1000m',
    memoryRequest: '512Mi',
    memoryLimit: '3Gi'
  },
  dev: {
    namespace: 'b1d40d-dev',
    name: `${name}`,
    phase: 'dev',
    changeId: deployChangeId,
    suffix: `-dev-${deployChangeId}`,
    instance: `${name}-dev-${deployChangeId}`,
    version: `${deployChangeId}-${changeId}`,
    tag: `dev-${version}-${deployChangeId}`,
    host: (isStaticDeployment && staticUrls.dev) || `${name}-${changeId}-b1d40d-dev.apps.silver.devops.gov.bc.ca`,
    apiHost:
      (isStaticDeployment && staticUrlsAPI.dev) || `${apiName}-${changeId}-b1d40d-dev.apps.silver.devops.gov.bc.ca`,
    siteminderLogoutURL: config.siteminderLogoutURL.dev,
    maxUploadNumFiles,
    maxUploadFileSize,
    env: 'dev',
    sso: config.sso.dev,
    cpuRequest: '50m',
    cpuLimit: (isStaticDeployment && '300m') || '200m',
    memoryRequest: '50Mi',
    memoryLimit: (isStaticDeployment && '300Mi') || '200Mi',
    replicas: '1',
    replicasMax: (isStaticDeployment && '2') || '1'
  },
  test: {
    namespace: 'b1d40d-test',
    name: `${name}`,
    phase: 'test',
    changeId: deployChangeId,
    suffix: `-test`,
    instance: `${name}-test`,
    version: `${version}`,
    tag: `test-${version}`,
    host: staticUrls.test,
    apiHost: staticUrlsAPI.test,
    siteminderLogoutURL: config.siteminderLogoutURL.test,
    maxUploadNumFiles,
    maxUploadFileSize,
    env: 'test',
    sso: config.sso.test,
    cpuRequest: '100m',
    cpuLimit: '400m',
    memoryRequest: '100Mi',
    memoryLimit: '400Mi',
    replicas: '2',
    replicasMax: '3'
  },
  prod: {
    namespace: 'b1d40d-prod',
    name: `${name}`,
    phase: 'prod',
    changeId: deployChangeId,
    suffix: `-prod`,
    instance: `${name}-prod`,
    version: `${version}`,
    tag: `prod-${version}`,
    host: staticUrls.prod,
    apiHost: staticUrlsAPI.prod,
    siteminderLogoutURL: config.siteminderLogoutURL.prod,
    maxUploadNumFiles,
    maxUploadFileSize,
    env: 'prod',
    sso: config.sso.prod,
    cpuRequest: '100m',
    cpuLimit: '400m',
    memoryRequest: '100Mi',
    memoryLimit: '400Mi',
    replicas: '2',
    replicasMax: '3'
  }
};

module.exports = exports = { phases, options };
