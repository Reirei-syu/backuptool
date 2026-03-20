export const isFileSystemApiSupported = () => 'showDirectoryPicker' in window;

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
    let nextValue: unknown = this.file;

    return {
      write: async (data: unknown) => {
        nextValue = data;
      },
      close: async () => {
        if (nextValue instanceof File) {
          this.file = nextValue;
          return;
        }

        if (nextValue instanceof Blob) {
          this.file = new File([await nextValue.arrayBuffer()], this.name, {
            type: nextValue.type,
            lastModified: Date.now(),
          });
          return;
        }

        const parts = Array.isArray(nextValue) ? nextValue : [nextValue];
        this.file = new File(parts as BlobPart[], this.name, { lastModified: Date.now() });
      },
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
      if (handle?.kind === 'directory') {
        return handle as MockDirectoryHandle;
      }
      throw new Error('Type mismatch');
    }

    if (options?.create) {
      const newDirectory = new MockDirectoryHandle(name);
      this.children.set(name, newDirectory);
      return newDirectory;
    }

    throw new Error('NotFound');
  }

  async getFileHandle(name: string, options?: { create?: boolean }) {
    if (this.children.has(name)) {
      const handle = this.children.get(name);
      if (handle?.kind === 'file') {
        return handle as MockFileHandle;
      }
      throw new Error('Type mismatch');
    }

    if (options?.create) {
      const newFile = new MockFileHandle(new File([''], name, { lastModified: Date.now() }));
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

export const convertFileListToHandle = (files: FileList): MockDirectoryHandle => {
  if (files.length === 0) {
    return new MockDirectoryHandle('selected-folder');
  }

  const rootName = files[0].webkitRelativePath.split('/')[0] || 'selected-folder';
  const rootHandle = new MockDirectoryHandle(rootName);

  Array.from(files).forEach((file) => {
    const parts = file.webkitRelativePath.split('/');
    let currentDirectory = rootHandle;

    for (let index = 1; index < parts.length - 1; index += 1) {
      const segment = parts[index];
      if (!currentDirectory.children.has(segment)) {
        currentDirectory.children.set(segment, new MockDirectoryHandle(segment));
      }
      currentDirectory = currentDirectory.children.get(segment) as MockDirectoryHandle;
    }

    const fileName = parts[parts.length - 1];
    currentDirectory.children.set(fileName, new MockFileHandle(file));
  });

  return rootHandle;
};
