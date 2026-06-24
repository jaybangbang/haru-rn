const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withModularHeaders = (config) => {
  return withDangerousMod(config, [
    'ios',
    (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      if (fs.existsSync(podfilePath)) {
        let podfile = fs.readFileSync(podfilePath, 'utf8');
        if (!podfile.includes('use_modular_headers!')) {
          podfile = podfile.replace(
            /^(target '[^']+' do\n)/m,
            '$1  use_modular_headers!\n'
          );
          fs.writeFileSync(podfilePath, podfile);
        }
      }
      return config;
    },
  ]);
};

module.exports = withModularHeaders;
