import { useState, useCallback } from "react";
import JSZip from "jszip";
import {
  Folder,
  File,
  CheckSquare,
  Square,
  ChevronRight,
  ChevronDown,
  Upload,
  Archive,
  FolderRoot,
  X,
  Check,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface ZipUploaderProps {
  onUpload: (files: Array<{ path: string; content: string }>) => void;
}

interface TreeNode {
  name: string;
  path: string;
  type: "file" | "folder";
  children: TreeNode[];
  content?: string;
}

export function ZipUploader({ onUpload }: ZipUploaderProps) {
  const [tree, setTree] = useState<TreeNode | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rootPath, setRootPath] = useState("");
  const [currentFolderPath, setCurrentFolderPath] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showRootInfo, setShowRootInfo] = useState(false);

  const normalizeZipPath = (value: string) =>
    value
      .replace(/\\/g, "/")
      .split("/")
      .filter(Boolean)
      .join("/");

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);

    try {
      const zip = await JSZip.loadAsync(file);
      const root: TreeNode = { name: file.name, path: "", type: "folder", children: [] };
      const allFiles: Map<string, string> = new Map();

      const entries = Object.entries(zip.files);
      for (const [path, zipEntry] of entries) {
        if (zipEntry.dir) continue;
        const normalizedPath = normalizeZipPath(path);
        if (!normalizedPath) continue;
        const content = await zipEntry.async("base64");
        allFiles.set(normalizedPath, content);
      }

      for (const [filePath] of allFiles) {
        const parts = normalizeZipPath(filePath).split("/").filter(Boolean);
        let current = root;
        for (let i = 0; i < parts.length; i++) {
          const part = parts[i];
          const isFile = i === parts.length - 1;
          let child = current.children.find((c) => c.name === part);
          if (!child) {
            child = {
              name: part,
              path: parts.slice(0, i + 1).join("/"),
              type: isFile ? "file" : "folder",
              children: [],
              content: isFile ? allFiles.get(filePath) : undefined,
            };
            current.children.push(child);
          }
          current = child;
        }
      }

      const sortNode = (node: TreeNode) => {
        node.children.sort((a, b) => {
          if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
        node.children.forEach(sortNode);
      };
      sortNode(root);

      setTree(root);
      const allPaths = new Set<string>();
      const collectFiles = (node: TreeNode) => {
        if (node.type === "file") allPaths.add(node.path);
        node.children.forEach(collectFiles);
      };
      collectFiles(root);
      setSelected(allPaths);
      setExpanded(new Set([root.path]));
      setRootPath("");
      setCurrentFolderPath("");
      setShowRootInfo(false);
    } catch {
      // ignore
    }
    setLoading(false);
    e.target.value = "";
  }, []);

  const toggleExpand = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const findNode = (node: TreeNode, targetPath: string): TreeNode | null => {
    if (node.path === targetPath) return node;
    for (const child of node.children) {
      const found = findNode(child, targetPath);
      if (found) return found;
    }
    return null;
  };

  const getFilesUnder = (node: TreeNode): string[] => {
    if (node.type === "file") return [node.path];
    return node.children.flatMap(getFilesUnder);
  };

  const toggleSelect = (node: TreeNode) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const files = getFilesUnder(node);
      const allSelected = files.every((f) => next.has(f));
      if (allSelected) {
        files.forEach((f) => next.delete(f));
      } else {
        files.forEach((f) => next.add(f));
      }
      return next;
    });
  };

  // Improved root selection with better UX
  const setUploadRoot = (folderPath: string) => {
    const normalizedFolderPath = normalizeZipPath(folderPath);
    
    if (rootPath === normalizedFolderPath) {
      // Clear root selection
      setRootPath("");
      setShowRootInfo(false);
      
      // Reselect all files
      if (tree) {
        const allPaths = new Set<string>();
        const collectFiles = (node: TreeNode) => {
          if (node.type === "file") allPaths.add(node.path);
          node.children.forEach(collectFiles);
        };
        collectFiles(tree);
        setSelected(allPaths);
      }
      return;
    }

    setRootPath(normalizedFolderPath);
    setShowRootInfo(true);

    // Auto-select only files under the root
    if (tree) {
      const rootNode = findNode(tree, normalizedFolderPath);
      if (rootNode) {
        const filesUnderRoot = new Set<string>();
        const collectFiles = (node: TreeNode) => {
          if (node.type === "file") filesUnderRoot.add(node.path);
          node.children.forEach(collectFiles);
        };
        collectFiles(rootNode);
        setSelected(filesUnderRoot);

        // Auto-expand the root folder and its parents
        setExpanded((prev) => {
          const next = new Set(prev);
          const pathParts = normalizedFolderPath.split("/");
          let currentPath = "";
          pathParts.forEach((part) => {
            currentPath = currentPath ? `${currentPath}/${part}` : part;
            next.add(currentPath);
          });
          return next;
        });
      }
    }
  };

  const clearRoot = () => {
    setRootPath("");
    setShowRootInfo(false);
    
    // Reselect all files
    if (tree) {
      const allPaths = new Set<string>();
      const collectFiles = (node: TreeNode) => {
        if (node.type === "file") allPaths.add(node.path);
        node.children.forEach(collectFiles);
      };
      collectFiles(tree);
      setSelected(allPaths);
    }
  };

  const getUploadableFiles = (): Array<{ path: string; content: string }> => {
    if (!tree) return [];
    const files: Array<{ path: string; content: string }> = [];
    const collect = (node: TreeNode) => {
      if (node.type === "file" && selected.has(node.path) && node.content) {
        const normalizedNodePath = normalizeZipPath(node.path);
        if (rootPath) {
          if (!normalizedNodePath.startsWith(rootPath + "/")) {
            return;
          }
          const uploadPath = normalizedNodePath.slice(rootPath.length + 1);
          files.push({ path: uploadPath, content: node.content });
        } else {
          files.push({ path: normalizedNodePath, content: node.content });
        }
      }
      node.children.forEach(collect);
    };
    collect(tree);
    return files;
  };

  const uploadableFiles = tree ? getUploadableFiles() : [];

  const handleUpload = async () => {
    if (uploadableFiles.length === 0) return;
    setUploading(true);
    await onUpload(uploadableFiles);
    setUploading(false);
  };

  const isUnderRoot = (filePath: string): boolean => {
    if (!rootPath) return true;
    return normalizeZipPath(filePath).startsWith(rootPath + "/");
  };

  const renderNode = (node: TreeNode, depth = 0) => {
    const isExpanded = expanded.has(node.path);
    const filesUnder = getFilesUnder(node);
    const allSelected = filesUnder.length > 0 && filesUnder.every((f) => selected.has(f));
    const someSelected = filesUnder.some((f) => selected.has(f));
    const isRoot = rootPath === node.path;
    const dimmed = rootPath && node.type === "file" && !isUnderRoot(node.path);
    const folderOutsideRoot = rootPath && node.type === "folder" && node.path && !node.path.startsWith(rootPath) && !rootPath.startsWith(node.path);

    return (
      <div key={node.path || "root"}>
        <div
          className={`flex items-center gap-2 py-1.5 px-2 rounded-md text-sm hover:bg-secondary/50 transition-colors ${
            isRoot ? "bg-primary/10 border border-primary/30" : ""
          } ${dimmed || folderOutsideRoot ? "opacity-30" : ""}`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          {node.type === "folder" ? (
            <button onClick={() => toggleExpand(node.path)} className="shrink-0">
              {isExpanded ? (
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
              )}
            </button>
          ) : (
            <span className="w-3" />
          )}

          <button onClick={() => toggleSelect(node)} className="shrink-0">
            {allSelected ? (
              <CheckSquare className="h-4 w-4 text-primary" />
            ) : someSelected ? (
              <CheckSquare className="h-4 w-4 text-primary/50" />
            ) : (
              <Square className="h-4 w-4 text-muted-foreground" />
            )}
          </button>

          {node.type === "folder" ? (
            <Folder className="h-4 w-4 text-accent shrink-0" />
          ) : (
            <File className="h-4 w-4 text-muted-foreground shrink-0" />
          )}

          <span className="truncate flex-1 text-xs">{node.name}</span>

          {node.type === "folder" && node.path && (
            <button
              onClick={() => setUploadRoot(node.path)}
              className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded shrink-0 transition-colors ${
                isRoot
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80"
              }`}
            >
              <FolderRoot className="h-3 w-3" />
              {isRoot ? "Root ✓" : "Set as root"}
            </button>
          )}
        </div>

        {isExpanded && node.children.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  };

  const currentFolder = tree ? (currentFolderPath ? findNode(tree, currentFolderPath) ?? tree : tree) : null;
  const currentChildren = currentFolder?.children ?? [];
  const folderParts = currentFolderPath ? currentFolderPath.split("/") : [];
  const canGoUp = folderParts.length > 0;

  const goToParent = () => {
    if (!canGoUp) return;
    setCurrentFolderPath(folderParts.slice(0, -1).join("/"));
  };

  const openFolder = (node: TreeNode) => {
    if (node.type !== "folder") return;
    setCurrentFolderPath(node.path);
  };

  return (
    <div className="space-y-3">
      {!tree ? (
        <div className="border-2 border-dashed border-border rounded-xl p-8 text-center">
          <Archive className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-3">Select a ZIP file to preview its contents</p>
          <input
            type="file"
            accept=".zip"
            onChange={handleFile}
            className="text-xs w-full max-w-xs mx-auto file:mr-2 file:py-1 file:px-3 file:rounded-md file:border-0 file:bg-primary file:text-primary-foreground file:text-xs file:cursor-pointer"
          />
          {loading && <p className="text-xs text-muted-foreground mt-2 animate-pulse">Reading ZIP...</p>}
        </div>
      ) : (
        <>
          {/* Breadcrumb and folder navigation */}
          <div className="bg-card border border-border rounded-xl p-2.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={goToParent}
                disabled={!canGoUp}
                className="text-[10px] px-2 py-1 rounded bg-secondary disabled:opacity-40 disabled:cursor-not-allowed hover:bg-secondary/80 transition-colors"
              >
                ← Back
              </button>
              <div className="flex-1 min-w-0 text-[10px] text-muted-foreground overflow-x-auto whitespace-nowrap">
                <button onClick={() => setCurrentFolderPath("")} className="hover:text-foreground transition-colors">
                  root
                </button>
                {folderParts.map((part, i) => {
                  const partial = folderParts.slice(0, i + 1).join("/");
                  return (
                    <span key={partial}>
                      {" / "}
                      <button onClick={() => setCurrentFolderPath(partial)} className="hover:text-foreground transition-colors">
                        {part}
                      </button>
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-muted-foreground">
                📁 {currentChildren.length} item(s) in this folder
              </span>
              {currentFolderPath && (
                <button
                  onClick={() => setUploadRoot(currentFolderPath)}
                  className={`text-[10px] px-2 py-1 rounded transition-colors ${
                    rootPath === currentFolderPath
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                  }`}
                >
                  {rootPath === currentFolderPath ? "✓ Root folder" : "📌 Set as upload root"}
                </button>
              )}
            </div>
          </div>

          {/* Current folder contents */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-3 py-2 border-b border-border flex items-center justify-between bg-secondary/20">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium">📂 Current Folder</span>
                {rootPath && rootPath === currentFolderPath && (
                  <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full flex items-center gap-1">
                    <FolderRoot className="h-3 w-3" />
                    Upload root
                  </span>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground">
                {uploadableFiles.length} file(s) will be uploaded
              </span>
            </div>
            <div className="max-h-[50vh] overflow-y-auto p-1">
              {currentChildren.length === 0 ? (
                <p className="text-xs text-muted-foreground px-2 py-3 text-center">This folder is empty.</p>
              ) : (
                currentChildren.map((node) => {
                  const filesUnder = getFilesUnder(node);
                  const allSelected = filesUnder.length > 0 && filesUnder.every((f) => selected.has(f));
                  const someSelected = filesUnder.some((f) => selected.has(f));
                  const isRoot = rootPath === node.path;
                  const dimmed = rootPath && node.type === "file" && !isUnderRoot(node.path);
                  const folderOutsideRoot = rootPath && node.type === "folder" && node.path && !node.path.startsWith(rootPath) && !rootPath.startsWith(node.path);

                  return (
                    <div
                      key={node.path}
                      className={`flex items-center gap-2 py-1.5 px-2 rounded-md text-sm hover:bg-secondary/50 transition-colors ${
                        isRoot ? "bg-primary/10 border border-primary/30" : ""
                      } ${dimmed || folderOutsideRoot ? "opacity-30" : ""}`}
                    >
                      {node.type === "folder" ? (
                        <button onClick={() => openFolder(node)} className="shrink-0 hover:bg-secondary/50 p-0.5 rounded">
                          <ChevronRight className="h-3 w-3 text-muted-foreground" />
                        </button>
                      ) : (
                        <span className="w-3" />
                      )}

                      <button onClick={() => toggleSelect(node)} className="shrink-0">
                        {allSelected ? (
                          <CheckSquare className="h-4 w-4 text-primary" />
                        ) : someSelected ? (
                          <CheckSquare className="h-4 w-4 text-primary/50" />
                        ) : (
                          <Square className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>

                      {node.type === "folder" ? (
                        <Folder className="h-4 w-4 text-accent shrink-0" />
                      ) : (
                        <File className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}

                      <button
                        onClick={() => (node.type === "folder" ? openFolder(node) : null)}
                        className="truncate flex-1 text-left text-xs hover:text-primary transition-colors"
                      >
                        {node.name}
                      </button>

                      {node.type === "folder" && (
                        <button
                          onClick={() => setUploadRoot(node.path)}
                          className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded shrink-0 transition-colors ${
                            isRoot
                              ? "bg-primary text-primary-foreground"
                              : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                          }`}
                        >
                          <FolderRoot className="h-3 w-3" />
                          {isRoot ? "Root ✓" : "Set as root"}
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Root info banner - improved visibility */}
          {rootPath && showRootInfo && (
            <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <FolderRoot className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-primary">Upload Root Set</div>
                    <div className="text-[11px] text-muted-foreground">
                      Only files inside <span className="font-mono text-primary font-medium bg-primary/5 px-1 py-0.5 rounded">{rootPath}/</span> will be uploaded
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      ✅ {uploadableFiles.length} file(s) will be uploaded from this location
                    </div>
                  </div>
                </div>
                <button
                  onClick={clearRoot}
                  className="shrink-0 text-muted-foreground hover:text-destructive transition-colors p-0.5"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={clearRoot}
                  className="text-[10px] px-2 py-0.5 rounded bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                >
                  Clear root
                </button>
                <button
                  onClick={() => setShowRootInfo(false)}
                  className="text-[10px] px-2 py-0.5 rounded bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Help tooltip for root concept */}
          <div className="flex items-center justify-end">
            <button
              onClick={() => setShowRootInfo(!showRootInfo)}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <Info className="h-3 w-3" />
              What is upload root?
            </button>
          </div>

          {/* Optional: Full tree view - moved to bottom with better labeling */}
          <details className="bg-card border border-border rounded-xl overflow-hidden">
            <summary className="px-3 py-2 text-xs font-medium cursor-pointer select-none hover:bg-secondary/20 transition-colors">
              📋 View full ZIP structure
            </summary>
            <div className="max-h-[40vh] overflow-y-auto p-1 border-t border-border">
              {renderNode(tree)}
            </div>
          </details>

          {/* Upload button */}
          <Button 
            onClick={handleUpload} 
            disabled={uploadableFiles.length === 0 || uploading} 
            className="w-full"
          >
            <Upload className="h-4 w-4 mr-2" />
            {uploading ? "Uploading..." : `Upload ${uploadableFiles.length} file(s)`}
          </Button>

          {/* Reset button */}
          <button
            onClick={() => { 
              setTree(null); 
              setSelected(new Set()); 
              setRootPath(""); 
              setCurrentFolderPath("");
              setShowRootInfo(false);
            }}
            className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Choose different ZIP
          </button>
        </>
      )}
    </div>
  );
}
