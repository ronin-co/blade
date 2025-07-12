import { get } from 'ronin';

// biome-ignore lint/nursery/useExplicitType: In a real scenario, there is no type.
export default () => [get.account.with({ handle: 'elaine' })];
