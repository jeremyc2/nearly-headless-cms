import { AllowAllAuthorization } from "nearly-headless-cms/adapters";

/** Open authorization for the example CMS. Replace this layer to enforce real policies. */
export const {layer} = AllowAllAuthorization;
