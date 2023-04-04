import {
  copyNodeModules,
  ensureNxProject,
  readFile,
  readJson,
  runCommand,
  runNxCommandAsync,
  uniq,
} from '@nrwl/nx-plugin/testing';
import { copyFileSync, readFileSync, writeFileSync, rmSync } from 'fs';
import {
  checkFilesExist,
  updateFile,
} from '@nrwl/nx-plugin/src/utils/testing-utils/utils';
import { names } from '@nrwl/devkit';

const TIMEOUT = 120000;
const projectName = 'nx-sonarqube';
const project = uniq(projectName);
const project2 = uniq(projectName);
const implicitProject = uniq(`implicit-${projectName}`);
const projects = [project, project2, implicitProject];

describe('nx-sonarqube e2e', () => {
  const hostUrl = process.env.SONAR_HOST_URL || 'https://sonarcloud.io';
  const projectKey = process.env.SONAR_PROJECT_KEY || 'nx-sonarqube-e2e';
  const organization = process.env.SONAR_ORGANIZATION || 'koliveira15';
  const exclusions = '**/*.spec.ts';

  beforeAll(async () => {
    ensureNxProject('@koliveira15/nx-sonarqube', 'dist/packages/nx-sonarqube');
    copyNodeModules(['@nrwl/jest', '@nrwl/js']);
    await createLibs(projects);
    await createDependency(project, project2);
    setupGlobalJest();
    runCommand(`git init`); // workaround for initiating nx & projectGraph
  }, TIMEOUT);

  afterAll(() => {
    runNxCommandAsync('reset');
  });

  it(
    'should generate test coverage, configure nx-sonarqube target, & include static and implicit sources in the scan',
    async () => {
      // await runNxCommandAsync(
      //   `generate @koliveira15/nx-sonarqube:config --name ${project} --hostUrl ${hostUrl} --projectKey ${projectKey} --projectName ${projectKey} --organization ${organization} --exclusions ${exclusions}`
      // );
      await runNxCommandAsync(
        `generate @koliveira15/nx-sonarqube:config --name ${project} --hostUrl ${hostUrl} --projectKey ${projectKey} --projectName ${projectKey}  --exclusions ${exclusions}`
      );
      await runNxCommandAsync(`sonar ${project} --skip-nx-cache`);

      checkFilesExist(
        `coverage/libs/${project}/lcov.info`,
        `coverage/libs/${project2}/lcov.info`,
        `coverage/libs/${implicitProject}/lcov.info`
      );
    },
    TIMEOUT
  );

  it(
    'should generate test coverage, configure nx-sonarqube target, & include ONLY static sources in the scan',
    async () => {
      const projectPath = `libs/${project}/project.json`;
      const projectJson = readJson(projectPath);
      projectJson.targets.sonar.options.skipImplicitDeps = true;
      writeFileSync(
        `tmp/nx-e2e/proj/${projectPath}`,
        JSON.stringify(projectJson, null, 2)
      );

      await runNxCommandAsync(`sonar ${project} --skip-nx-cache`);

      checkFilesExist(
        `coverage/libs/${project}/lcov.info`,
        `coverage/libs/${project2}/lcov.info`,
        `coverage/libs/${implicitProject}/lcov.info`
      );
    },
    TIMEOUT
  );
  it(
    'should recognize coverageDirectory in test config',
    async () => {
      const projectPath = `libs/${project}/project.json`;
      const projectJson = readJson(projectPath);
      const project2Path = `libs/${project2}/project.json`;
      const project2Json = readJson(project2Path);
      const projectJestPath = `libs/${project}/jest.config.ts`;
      const project2JestPath = `libs/${project2}/jest.config.ts`;
      const projectTmpJestPath = `libs/${project}/jest.tmp`;
      const project2TmpJestPath = `libs/${project2}/jest.tmp`;
      copyFileSync(
        `tmp/nx-e2e/proj/${projectJestPath}`,
        `tmp/nx-e2e/proj/${projectTmpJestPath}`
      );
      copyFileSync(
        `tmp/nx-e2e/proj/${project2JestPath}`,
        `tmp/nx-e2e/proj/${project2TmpJestPath}`
      );
      removeLineFromFile(
        `coverageDirectory`,
        `tmp/nx-e2e/proj/${projectJestPath}`
      );
      removeLineFromFile(
        `coverageDirectory`,
        `tmp/nx-e2e/proj/${project2JestPath}`
      );

      projectJson.targets.test.options.coverageDirectory = `coverage/changed/libs/${project}`;
      project2Json.targets.test.options.coverageDirectory = `coverage/changed/libs/${project2}`;
      writeFileSync(
        `tmp/nx-e2e/proj/${projectPath}`,
        JSON.stringify(projectJson, null, 2)
      );
      writeFileSync(
        `tmp/nx-e2e/proj/${project2Path}`,
        JSON.stringify(project2Json, null, 2)
      );

      await runNxCommandAsync(`sonar ${project} --skip-nx-cache`);
      checkFilesExist(
        `coverage/changed/libs/${project}/lcov.info`,
        `coverage/changed/libs/${project2}/lcov.info`
      );
      // cleanup
      // remove changes so it won't affect later tests
      delete projectJson.targets.test.options.coverageDirectory;
      delete project2Json.targets.test.options.coverageDirectory;
      writeFileSync(
        `tmp/nx-e2e/proj/${projectPath}`,
        JSON.stringify(projectJson, null, 2)
      );
      writeFileSync(
        `tmp/nx-e2e/proj/${project2Path}`,
        JSON.stringify(project2Json, null, 2)
      );
      copyFileSync(
        `tmp/nx-e2e/proj/${projectTmpJestPath}`,
        `tmp/nx-e2e/proj/${projectJestPath}`
      );
      copyFileSync(
        `tmp/nx-e2e/proj/${project2TmpJestPath}`,
        `tmp/nx-e2e/proj/${project2JestPath}`
      );
      rmSync(`tmp/nx-e2e/proj/${projectTmpJestPath}`);
      rmSync(`tmp/nx-e2e/proj/${project2TmpJestPath}`);
    },
    TIMEOUT
  );
});

async function createDependency(project: string, project2: string) {
  const declaration = names(project).propertyName;
  const importPath = names(project).fileName;
  const declaration2 = names(project2).propertyName;
  const importPath2 = names(project2).fileName;
  const content = `import {${declaration2}} from '@proj/${importPath2}';
                      export function ${declaration}(): string {
                        return ${declaration2}();
                    }`;
  const specContent = readFile(
    `libs/${project}/src/lib/${project}.spec.ts`
  ).replace(`.toEqual('${importPath}')`, `.toBeDefined();`);
  updateFile(`libs/${project}/src/lib/${project}.ts`, content);
  updateFile(`libs/${project}/src/lib/${project}.spec.ts`, specContent);

  const projectPath = `libs/${project}/project.json`;
  const projectJson = readJson(projectPath);
  projectJson.targets.test.options.codeCoverage = true;
  projectJson.implicitDependencies = [implicitProject];
  writeFileSync(
    `tmp/nx-e2e/proj/${projectPath}`,
    JSON.stringify(projectJson, null, 2)
  );
}

async function createLibs(projects: string[]) {
  for (let i = 0; i < projects.length; i++) {
    await runNxCommandAsync(
      `generate @nrwl/js:lib --name ${projects[i]} --unitTestRunner=jest`
    );

    const projectPath = `libs/${projects[i]}/project.json`;
    const projectJson = readJson(projectPath);
    projectJson.targets.test.options.codeCoverage = true;
    writeFileSync(
      `tmp/nx-e2e/proj/${projectPath}`,
      JSON.stringify(projectJson, null, 2)
    );
  }
}
function removeLineFromFile(line: string, filePath: string) {
  let content = readFileSync(filePath, 'utf-8');
  let regex = new RegExp(`^.*${line}.*$`, 'mg');

  content = content.replace(regex, '');
  writeFileSync(filePath, content);
}
function setupGlobalJest() {
  const jest = readFile(`jest.preset.js`).replace(
    'module.exports = { ...nxPreset };',
    `module.exports = {
  ...nxPreset,
  collectCoverage: true,
  coverageReporters: ["lcov"],
};`
  );
  updateFile(`jest.preset.js`, jest);
}
