import { filesystemLoader } from './loaders/filesystem';
import {
  IDisposable,
  IFilesystemLoaderOpts,
  IForwarder,
  ILoader,
  IMocker,
  IPrism,
  IPrismComponents,
  IPrismConfig,
  IPrismInput,
  IPrismOutput,
  IRouter,
  IValidation,
  IValidator,
  PrismConfigFactory,
} from './types';

export function factory<Resource, Input, Output, Config, LoadOpts>(
  defaultComponents: Partial<IPrismComponents<Resource, Input, Output, Config, LoadOpts>>
): (
  customComponents?: Partial<IPrismComponents<Resource, Input, Output, Config, LoadOpts>>
) => IPrism<Resource, Input, Output, Config, LoadOpts> {
  return customComponents => {
    const components: Partial<
      IPrismComponents<Resource, Input, Output, Config, LoadOpts>
    > = Object.assign({}, defaultComponents, customComponents);

    // our loaded resources (HttpOperation objects, etc)
    let resources: Resource[] = [];

    return {
      get resources(): Resource[] {
        return resources;
      },

      load: async (opts?: LoadOpts): Promise<void> => {
        const { loader } = components;
        if (opts && loader) {
          resources = await loader.load(opts, defaultComponents.loader);
        }
      },

      process: async (input, c) => {
        // await lazyLoad();
        const currentConfig = c || components.config;

        // build the config for this request
        let configObj: Config | undefined;
        if (currentConfig instanceof Function) {
          // config factory function
          configObj = await (currentConfig as PrismConfigFactory<Config, Input>)(
            input,
            defaultComponents.config
          );
        } else if (currentConfig) {
          configObj = currentConfig as Config;
        }

        // find the correct resource
        let resource: Resource | undefined;
        if (components.router) {
          resource = await components.router.route(
            { resources, input, config: configObj },
            defaultComponents.router
          );
        }

        // validate input
        let inputValidations: IValidation[] = [];
        if (resource && components.validator && components.validator.validateInput) {
          inputValidations = await components.validator.validateInput(
            {
              resource,
              input,
              config: configObj,
            },
            defaultComponents.validator
          );
        }

        // build output
        let output: Output | undefined;
        if (resource && components.mocker && (configObj as IPrismConfig).mock) {
          // generate the response
          output = await components.mocker.mock(
            {
              resource,
              input: { validations: { input: inputValidations }, data: input },
              config: configObj,
            },
            defaultComponents.mocker
          );
        } else if (components.forwarder) {
          // forward request and set output from response
          output = await components.forwarder.forward(
            {
              resource,
              input: { validations: { input: inputValidations }, data: input },
              config: configObj,
            },
            defaultComponents.forwarder
          );
        }

        // validate output
        let outputValidations: IValidation[] = [];
        if (resource && components.validator && components.validator.validateOutput) {
          outputValidations = await components.validator.validateOutput(
            {
              resource,
              output,
              config: configObj,
            },
            defaultComponents.validator
          );
        }

        return {
          input,
          output,
          validations: {
            input: inputValidations,
            output: outputValidations,
          },
        };
      },
    };
  };
}

export {
  filesystemLoader,
  IDisposable,
  IFilesystemLoaderOpts,
  IForwarder,
  ILoader,
  IMocker,
  IPrism,
  IPrismComponents,
  IPrismConfig,
  IPrismInput,
  IPrismOutput,
  IRouter,
  IValidation,
  IValidator,
  PrismConfigFactory,
};