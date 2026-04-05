import { atom } from '@reatom/core'

/** Team IDs populated by the teams route loader. Used by settings for budget distribution. */
export const knownTeamIds = atom<string[]>([], 'teams.knownTeamIds')
