const DB_NAME = 'timber_tally_placemark_fs';
const STORE_NAME = 'directory_handles';
const FOLDER_KEY = 'my_placemarks_folder';

export interface PermissionCapableDirectoryHandle extends FileSystemDirectoryHandle {
  queryPermission?: (descriptor: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
  requestPermission?: (descriptor: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
  values?: () => AsyncIterableIterator<FileSystemHandle>;
}

interface DirectoryPickerOptions {
  id?: string;
  mode?: 'read' | 'readwrite';
  startIn?: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos' | FileSystemHandle;
}

type WindowWithDirectoryPicker = Window & {
  showDirectoryPicker?: (options?: DirectoryPickerOptions) => Promise<PermissionCapableDirectoryHandle>;
};

export function isDirectoryPickerSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof (window as WindowWithDirectoryPicker).showDirectoryPicker === 'function'
  );
}

function openFsDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is unavailable in this browser.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open folder storage.'));
  });
}

export async function getSavedPlacemarkFolderHandle(): Promise<PermissionCapableDirectoryHandle | null> {
  try {
    const db = await openFsDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(FOLDER_KEY);
      req.onsuccess = () => resolve((req.result as PermissionCapableDirectoryHandle) || null);
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  } catch {
    return null;
  }
}

export async function savePlacemarkFolderHandle(handle: PermissionCapableDirectoryHandle): Promise<void> {
  try {
    const db = await openFsDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(handle, FOLDER_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  } catch {
    // Ignore persistence error if IndexedDB is restricted
  }
}

export async function clearSavedPlacemarkFolderHandle(): Promise<void> {
  try {
    const db = await openFsDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(FOLDER_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  } catch {
    // Ignore cleanup error
  }
}

export async function ensureFolderWritePermission(
  handle: PermissionCapableDirectoryHandle,
  requestIfPrompt: boolean = true
): Promise<boolean> {
  try {
    if (typeof handle.queryPermission === 'function') {
      const current = await handle.queryPermission({ mode: 'readwrite' });
      if (current === 'granted') return true;
      if (!requestIfPrompt) return false;
      if (typeof handle.requestPermission === 'function') {
        const requested = await handle.requestPermission({ mode: 'readwrite' });
        return requested === 'granted';
      }
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Prompts the user (starting at Desktop) to select their "My Placemarks" folder.
 * If the user selects the Desktop root itself, automatically resolves/creates "My Placemarks" inside it.
 */
export async function pickMyPlacemarksFolder(): Promise<PermissionCapableDirectoryHandle> {
  const picker = (window as WindowWithDirectoryPicker).showDirectoryPicker;
  if (!picker) {
    throw new Error('Direct folder selection is not supported in this browser.');
  }

  let selected = await picker({
    id: 'my-placemarks-desktop',
    mode: 'readwrite',
    startIn: 'desktop',
  });

  if (selected.name.trim().toLowerCase() === 'desktop') {
    selected = (await selected.getDirectoryHandle('My Placemarks', {
      create: true,
    })) as PermissionCapableDirectoryHandle;
  }

  await savePlacemarkFolderHandle(selected);
  return selected;
}

/**
 * Scans the target folder for files matching "<PREFIX>-<NNN>.kml" and returns the next sequence number.
 */
export async function getNextSequenceInFolder(
  handle: PermissionCapableDirectoryHandle,
  filenamePrefix: string
): Promise<number> {
  let maxSeq = 0;
  const escapedPrefix = filenamePrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${escapedPrefix}-(\\d+)\\.kml$`, 'i');

  try {
    if (typeof handle.values === 'function') {
      for await (const entry of handle.values()) {
        if (entry.kind === 'file') {
          const match = entry.name.match(pattern);
          if (match) {
            const num = parseInt(match[1], 10);
            if (Number.isFinite(num) && num > maxSeq) {
              maxSeq = num;
            }
          }
        }
      }
    }
  } catch {
    // Ignore directory iteration errors
  }

  return maxSeq + 1;
}

export async function saveKmlToFolder(
  handle: PermissionCapableDirectoryHandle,
  filename: string,
  kmlContent: string
): Promise<void> {
  const fileHandle = await handle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(kmlContent);
  await writable.close();
}
