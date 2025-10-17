export const IS_CLIENT_DEV = import.meta.env.BLADE_ENV === 'development';

/**
 * A name prefix used to identify an input whose value should be used to resolve a target
 * record instead of being treated as a value to store in the record.
 *
 * We are using this prefix in order to enable progressive enhancement in the future,
 * meaning making it possible to submit forms even before their JavaScript is downloaded.
 */
export const FORM_TARGET_PREFIX = '__blade_target_';
