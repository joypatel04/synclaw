export type FilesystemNode = {
  name: string;
  path: string;
  type: "file" | "directory";
  size?: number | null;
  mtimeMs?: number | null;
};

