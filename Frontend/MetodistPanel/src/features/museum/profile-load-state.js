export const INITIAL_MUSEUM_PROFILE_LOAD_STATE = {status: 'loading', error: ''};

export function getMuseumProfileLoadState(currentState, event) {
  if (event.type === 'start') return {status: 'loading', error: ''};
  if (event.type === 'success') return {status: 'loaded', error: ''};
  if (event.type === 'failure' && event.status === 404) return {status: 'missing', error: ''};
  if (event.type === 'failure') return {status: 'error', error: event.message};
  return currentState;
}
