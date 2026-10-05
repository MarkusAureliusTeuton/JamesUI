export const UPDATE_TODO_ITEM = 4;
export const SET_DUE_DATE = 16;
export const SET_DUE_DATETIME = 32;
export const SET_DESCRIPTION = 64;

export function todoCapabilities(supportedFeatures) {
  const mask = Number.isInteger(supportedFeatures) && supportedFeatures >= 0 ? supportedFeatures : 0;
  return Object.freeze({
    can_update: (mask & UPDATE_TODO_ITEM) !== 0,
    can_set_due_date: (mask & SET_DUE_DATE) !== 0,
    can_set_due_datetime: (mask & SET_DUE_DATETIME) !== 0,
    can_set_description: (mask & SET_DESCRIPTION) !== 0,
  });
}
