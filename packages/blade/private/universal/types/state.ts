export type StateType = 'build-error';

export interface StateMessage {
  type: StateType;
  message: string;
}
