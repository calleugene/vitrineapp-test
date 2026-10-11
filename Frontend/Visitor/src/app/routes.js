// View registry for the Visitor app (mirrors the original main.js navigation maps).

export const HIDDEN_CHROME_VIEWS = new Set([
  'onboarding',
  'storyExperience',
  'qrScanner',
  'secretCode',
  'artifactFound',
  'artifactReceived',
  // Destructive account flows only (auth screens keep tab bar so user can dismiss)
  'deleteAccount',
  'accountDeleted',
]);

// Maps a view to the tab that should appear active while it is shown.
export const TAB_MAP = {
  museumSelect: 'museumSelect',
  museumDetail: 'museumSelect',
  artifactFound: 'museumSelect',
  artifactReceived: 'museumSelect',
  qrScanner: 'museumSelect',
  secretCode: 'museumSelect',
  profileCollection: 'profileCollection',
  artifactCard: 'profileCollection',
  profileHome: 'profileHome',
  myMuseums: 'profileHome',
  routeResult: 'profileHome',
  profileAchievements: 'profileHome',
  profileSettings: 'profileHome',
  publicProfile: 'profileHome',
  // Auth flows (hidden chrome, but mapped for safety)
  auth: 'profileHome',
  forgotPassword: 'profileHome',
  forgotPasswordSent: 'profileHome',
  resetPassword: 'profileHome',
  resetPasswordSuccess: 'profileHome',
  deleteAccount: 'profileHome',
  accountDeleted: 'profileHome',
};

export const TABS = [
  {id: 'museumSelect', label: 'Музеи'},
  {id: 'profileCollection', label: 'Коллекция'},
  {id: 'profileHome', label: 'Профиль'},
];
