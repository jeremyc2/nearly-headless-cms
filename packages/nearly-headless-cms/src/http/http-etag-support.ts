const httpEtagSupport = {
  ifNoneMatchMatches: (headerValue: string | null, etag: string): boolean => {
    if (headerValue === null) {
      return false;
    }
    const validators = headerValue.match(/(?:W\/)?"[^"]*"|\*/gu) ?? [],
      weakValidatorPrefixLength = 2;
    return validators.some((validator) => {
      if (validator === "*") {
        return true;
      }
      let normalizedValidator = validator;
      if (normalizedValidator.startsWith("W/")) {
        normalizedValidator = normalizedValidator.slice(weakValidatorPrefixLength);
      }
      return normalizedValidator === etag;
    });
  },
};

export default httpEtagSupport;
