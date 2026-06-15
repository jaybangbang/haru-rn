const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withRenameXcodeProject = (config, { projectName }) => {
  return withDangerousMod(config, [
    'ios',
    (config) => {
      const iosDir = config.modRequest.platformProjectRoot;

      // 1. scheme 파일 내용 수정 후 리네임
      const schemeDir = path.join(iosDir, 'app.xcodeproj', 'xcshareddata', 'xcschemes');
      const oldScheme = path.join(schemeDir, 'app.xcscheme');
      const newScheme = path.join(schemeDir, `${projectName}.xcscheme`);
      if (fs.existsSync(oldScheme)) {
        let content = fs.readFileSync(oldScheme, 'utf8');
        content = content.replace(/BuildableName = "app\.app"/g, `BuildableName = "${projectName}.app"`);
        content = content.replace(/BlueprintName = "app"/g, `BlueprintName = "${projectName}"`);
        content = content.replace(/container:app\.xcodeproj/g, `container:${projectName}.xcodeproj`);
        // ArchiveAction에 BuildableProductRunnable 추가 (없으면 archive 불가)
        if (!content.includes('<ArchiveAction') || content.includes('<ArchiveAction\n      buildConfiguration') && !content.includes('BuildableProductRunnable')) {
          content = content.replace(
            /(<ArchiveAction[^>]*>)\s*<\/ArchiveAction>/s,
            `$1\n      <BuildableProductRunnable\n         runnableDebuggingMode = "0">\n         <BuildableReference\n            BuildableIdentifier = "primary"\n            BlueprintIdentifier = "13B07F861A680F5B00A75B9A"\n            BuildableName = "${projectName}.app"\n            BlueprintName = "${projectName}"\n            ReferencedContainer = "container:${projectName}.xcodeproj">\n         </BuildableReference>\n      </BuildableProductRunnable>\n   </ArchiveAction>`
          );
        }
        fs.writeFileSync(newScheme, content);
        fs.unlinkSync(oldScheme);
      }

      // 2. project.pbxproj PRODUCT_NAME 변경
      const pbxprojPath = path.join(iosDir, 'app.xcodeproj', 'project.pbxproj');
      if (fs.existsSync(pbxprojPath)) {
        let content = fs.readFileSync(pbxprojPath, 'utf8');
        content = content.replace(/PRODUCT_NAME = app;/g, `PRODUCT_NAME = ${projectName};`);
        fs.writeFileSync(pbxprojPath, content);
      }

      // 3. Podfile에 use_modular_headers! 추가 (GoogleSignIn Swift pod 호환성)
      const podfilePath = path.join(iosDir, 'Podfile');
      if (fs.existsSync(podfilePath)) {
        let podfile = fs.readFileSync(podfilePath, 'utf8');
        if (!podfile.includes('use_modular_headers!')) {
          podfile = podfile.replace(
            /^(target 'app' do\n)/m,
            "$1  use_modular_headers!\n"
          );
          fs.writeFileSync(podfilePath, podfile);
        }
      }

      // 4. xcodeproj 리네임 (pod install 전에 해야 workspace가 올바른 이름으로 생성됨)
      const oldProj = path.join(iosDir, 'app.xcodeproj');
      const newProj = path.join(iosDir, `${projectName}.xcodeproj`);
      if (fs.existsSync(oldProj)) {
        fs.renameSync(oldProj, newProj);
      }

      return config;
    },
  ]);
};

module.exports = withRenameXcodeProject;
