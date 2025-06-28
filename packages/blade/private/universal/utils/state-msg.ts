export type StateType = 'build-error';

export interface StateMessage {
    type: StateType;
    message: string;
}

export function createStateMessage(type: StateType, message: string){
    let stateMessage: StateMessage = {
        type,
        message
    }
    return JSON.stringify(stateMessage)
}