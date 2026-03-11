
// Check if the API is supported
export const isFileSystemApiSupported = () => {
  return 'showDirectoryPicker' in window;
};

// Mock classes to simulate File System Access API structure
export class MockFileSystemHandle {
  kind: 'file' | 'directory';
  name: string;

  constructor(kind: 'file' | 'directory', name: string) {
    this.kind = kind;
    this.name = name;
  }

  async isSameEntry(other: MockFileSystemHandle) {
    return this === other;
  }
}

export class MockFileHandle extends MockFileSystemHandle {
  file: File;

  constructor(file: File) {
    super('file', file.name);
    this.file = file;
  }

  async getFile() {
    return this.file;
  }

  async createWritable() {
    return {
      write: async (_data: any) => { /* Mock write */ },
      close: async () => { /* Mock close */ },
    };
  }
}

export class MockDirectoryHandle extends MockFileSystemHandle {
  children: Map<string, MockFileSystemHandle>;

  constructor(name: string) {
    super('directory', name);
    this.children = new Map();
  }

  async getDirectoryHandle(name: string, options?: { create?: boolean }) {
    if (this.children.has(name)) {
      const handle = this.children.get(name);
      if (handle?.kind === 'directory') return handle as MockDirectoryHandle;
      throw new Error('Type mismatch');
    }
    if (options?.create) {
      const newDir = new MockDirectoryHandle(name);
      this.children.set(name, newDir);
      return newDir;
    }
    throw new Error('NotFound');
  }

  async getFileHandle(name: string, options?: { create?: boolean }) {
    if (this.children.has(name)) {
      const handle = this.children.get(name);
      if (handle?.kind === 'file') return handle as MockFileHandle;
      throw new Error('Type mismatch');
    }
    if (options?.create) {
      // Create a dummy file for simulation writing
      const dummyFile = new File([""], name); 
      const newFile = new MockFileHandle(dummyFile);
      this.children.set(name, newFile);
      return newFile;
    }
    throw new Error('NotFound');
  }

  async removeEntry(name: string, _options?: { recursive?: boolean }) {
    if (this.children.has(name)) {
      this.children.delete(name);
      return;
    }
    throw new Error('NotFound');
  }

  async *values() {
    for (const child of this.children.values()) {
      yield child;
    }
  }
}

// Helper to convert FileList (from input) to MockDirectoryHandle tree
export const convertFileListToHandle = (files: FileList): MockDirectoryHandle => {
  if (files.length === 0) return new MockDirectoryHandle('root');

  // Use the name of the first folder in the path as the root, or 'Root'
  const rootName = files[0].webkitRelativePath.split('/')[0] || 'Selected Folder';
  const rootHandle = new MockDirectoryHandle(rootName);

  Array.from(files).forEach(file => {
    const parts = file.webkitRelativePath.split('/');
    // parts[0] is the root folder name, we start from parts[1]
    let currentDir = rootHandle;

    for (let i = 1; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!currentDir.children.has(part)) {
        currentDir.children.set(part, new MockDirectoryHandle(part));
      }
      currentDir = currentDir.children.get(part) as MockDirectoryHandle;
    }

    const fileName = parts[parts.length - 1];
    currentDir.children.set(fileName, new MockFileHandle(file));
  });

  return rootHandle;
};
