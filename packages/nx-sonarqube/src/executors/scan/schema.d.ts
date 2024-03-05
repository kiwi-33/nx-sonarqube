export interface ScanExecutorSchema {
  hostUrl: string;
  projectKey: string;
  branches?: boolean;
  exclusions?: string;
  organization?: string;
  projectName?: string;
  projectVersion?: string;
  qualityGate?: boolean;
  qualityGateTimeout?: string;
  skipExplicitDeps?: boolean;
  skipImplicitDeps?: boolean;
  testInclusions?: string;
  tsConfig?: string;
  verbose?: boolean;
  coverageFilename?: string;
  extra?: { [option: string]: string };
}
