export const isElectronRenderer = (): boolean => {
  if (typeof window === 'undefined') return false;
  return Boolean((window as { electronAPI?: { isElectron?: boolean } }).electronAPI?.isElectron);
};
