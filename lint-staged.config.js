import path from 'node:path';

const SERVICES = ['patient-service', 'notification-service'];

const serviceOf = (file) => SERVICES.find((s) => path.relative(process.cwd(), file).startsWith(`${s}${path.sep}`));

const quote = (file) => JSON.stringify(file);

/**
 * Type-check and run related Jest tests only for the services that have staged changes.
 * `tsc` must run through each service's tsconfig, so filenames are not passed to it.
 */
const checkAffectedServices = (files) => {
  const services = [...new Set(files.map(serviceOf).filter(Boolean))];

  return services.flatMap((service) => {
    const serviceFiles = files.filter((f) => serviceOf(f) === service).map(quote).join(' ');
    return [
      `npm run typecheck -w ${service}`,
      `npm run test -w ${service} -- --findRelatedTests --passWithNoTests ${serviceFiles}`,
    ];
  });
};

/** @type {import('lint-staged').Configuration} */
export default {
  '*.ts': ['eslint --fix --max-warnings=0', checkAffectedServices],
  '*.js': 'eslint --fix --max-warnings=0',
};
